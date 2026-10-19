#!/usr/bin/env node
// Local-first CI: deletes stale GitHub Actions artifacts and caches, and writes a storage summary.
// Template from the local-first-ci skill. Copy it to .github/scripts/ with its tests.
//
//   GITHUB_TOKEN=<token> GITHUB_REPOSITORY=<owner/repo> [DEFAULT_BRANCH=<branch>] [DRY_RUN=true] \
//     [MAX_DELETES=<n>] [MAX_RUN_LOOKUPS=<n>] node .github/scripts/actions-cleanup.mjs [--dry-run]
//
// Artifacts:
//   - An artifact from a run on the default branch is never deleted. DEFAULT_BRANCH names it;
//     without it, the script reads the repository's default branch from the API.
//   - An artifact from a run on another branch is deleted when every pull request from that
//     branch is closed or merged, or when it is older than 48 hours.
//   - Only artifacts from `pull_request` and `push` runs are deleted. Dispatched, scheduled and
//     chained runs (deploy, evidence and operator workflows) keep theirs until their own
//     retention ends, so an operator flow never loses an artifact it is still reading.
// Caches: a cache is deleted when its branch no longer exists, or when its pull request
// (`refs/pull/<n>/...`) is closed. Default-branch and tag caches are kept.
//
// A run reads at most MAX_RUN_LOOKUPS workflow runs (default 200) and makes at most MAX_DELETES
// deletions (default 400), so it stays inside GITHUB_TOKEN's 1,000 requests an hour while a
// backlog lasts; the next day's run continues where it stopped.
//
// It prints the plan and a storage summary (count, and GB by name prefix and by branch) to
// stdout and, in Actions, to the job summary. A dry run plans the same deletions and makes none.
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_POLICY = Object.freeze({
  defaultBranch: 'main',
  maxAgeHours: 48,
  deletableEvents: Object.freeze(['pull_request', 'push']),
});

/** What `getRun` returns once the lookup limit is reached; the artifact waits for the next run. */
export const RUN_NOT_CHECKED = Symbol('run-not-checked');

const PAGE_SIZE = 100;
const MAX_PAGES = 500;
const GB = 1e9;

/** Every item of a paginated listing. `key` names the array in the response, or null for a bare array. */
export async function collectPages(get, path, key) {
  const items = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await get(`${path}${path.includes('?') ? '&' : '?'}per_page=${PAGE_SIZE}&page=${page}`);
    const batch = key === null ? response : response?.[key];
    if (!Array.isArray(batch)) throw new Error(`${path}: page ${page} has no ${key ?? 'array'}`);
    items.push(...batch);
    if (batch.length < PAGE_SIZE) return items;
  }
  throw new Error(`${path}: more than ${MAX_PAGES} pages`);
}

/** Branch name to `open` when any pull request from it is open, otherwise `closed`. */
export function pullRequestStates(pulls) {
  const states = new Map();
  for (const pull of pulls) {
    const branch = pull?.head?.ref;
    if (typeof branch !== 'string') continue;
    if (pull.state === 'open') states.set(branch, 'open');
    else if (!states.has(branch)) states.set(branch, 'closed');
  }
  return states;
}

/** An artifact name without a trailing commit SHA or run attempt, so runs group together. */
export function artifactPrefix(name) {
  return String(name).replace(/-[0-9a-f]{40}$/, '').replace(/-\d+$/, '');
}

/**
 * One `{ artifact, action: 'delete' | 'keep', reason }` per artifact. `getRun(id)` returns the
 * workflow run or undefined; it's called only for artifacts that the branch rules would delete.
 */
export async function planArtifacts(artifacts, { pulls, getRun, now, policy = DEFAULT_POLICY }) {
  const states = pullRequestStates(pulls);
  const plan = [];
  for (const artifact of artifacts) {
    const branch = artifact?.workflow_run?.head_branch;
    const decide = (action, reason) => plan.push({ artifact, action, reason });
    if (artifact.expired) { decide('keep', 'expired'); continue; }
    if (branch === policy.defaultBranch) { decide('keep', 'default-branch'); continue; }
    const ageHours = (now - Date.parse(artifact.created_at)) / 3_600_000;
    let reason;
    if (typeof branch === 'string' && states.get(branch) === 'closed') reason = 'closed-pull-request';
    else if (ageHours > policy.maxAgeHours) reason = `older-than-${policy.maxAgeHours}h`;
    if (reason === undefined) { decide('keep', 'recent'); continue; }
    const run = artifact.workflow_run?.id === undefined ? undefined : await getRun(artifact.workflow_run.id);
    if (run === RUN_NOT_CHECKED) { decide('keep', 'run-not-checked'); continue; }
    if (!run) { decide('keep', 'run-unreadable'); continue; }
    if (run.head_branch === policy.defaultBranch) { decide('keep', 'default-branch'); continue; }
    if (!policy.deletableEvents.includes(run.event)) { decide('keep', 'not-a-pull-request-or-push-run'); continue; }
    decide('delete', reason);
  }
  return plan;
}

/** One `{ cache, action, reason }` per cache: delete for a deleted branch or a closed pull request. */
export function planCaches(caches, { branches, pulls, policy = DEFAULT_POLICY }) {
  const live = new Set(branches);
  const pullStates = new Map(pulls.map((pull) => [Number(pull.number), pull.state]));
  return caches.map((cache) => {
    const ref = String(cache.ref ?? '');
    const head = /^refs\/heads\/(.+)$/.exec(ref)?.[1];
    const pull = /^refs\/pull\/(\d+)\//.exec(ref)?.[1];
    if (head !== undefined) {
      if (head === policy.defaultBranch || live.has(head)) return { cache, action: 'keep', reason: 'branch-exists' };
      return { cache, action: 'delete', reason: 'branch-deleted' };
    }
    if (pull !== undefined) {
      if (pullStates.get(Number(pull)) === 'closed') return { cache, action: 'delete', reason: 'pull-request-closed' };
      return { cache, action: 'keep', reason: 'pull-request-open-or-unknown' };
    }
    return { cache, action: 'keep', reason: 'other-ref' };
  });
}

function groupBy(entries, keyOf) {
  const groups = new Map();
  for (const { artifact } of entries) {
    const key = keyOf(artifact);
    const group = groups.get(key) ?? { key, count: 0, bytes: 0 };
    group.count += 1;
    group.bytes += Number(artifact.size_in_bytes) || 0;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.bytes - a.bytes || a.key.localeCompare(b.key));
}

/** Storage totals for unexpired artifacts, grouped by name prefix and by branch. */
export function summarize(artifactPlan) {
  const stored = artifactPlan.filter(({ artifact }) => !artifact.expired);
  const deleting = stored.filter(({ action }) => action === 'delete');
  const bytesOf = (entries) => entries.reduce((sum, { artifact }) => sum + (Number(artifact.size_in_bytes) || 0), 0);
  return {
    count: stored.length,
    bytes: bytesOf(stored),
    deleteCount: deleting.length,
    deleteBytes: bytesOf(deleting),
    byPrefix: groupBy(stored, (artifact) => artifactPrefix(artifact.name)),
    byBranch: groupBy(stored, (artifact) => artifact.workflow_run?.head_branch ?? '(unknown)'),
  };
}

const gb = (bytes) => (bytes / GB).toFixed(2);
const cell = (text) => String(text).replaceAll('|', '\\|');

export function renderSummary({ artifactPlan, cachePlan, dryRun, deferred = 0, limit = 20 }) {
  const summary = summarize(artifactPlan);
  const cacheDeletes = cachePlan.filter(({ action }) => action === 'delete');
  const unchecked = artifactPlan.filter(({ reason }) => reason === 'run-not-checked').length;
  const table = (title, rows) => [
    `### ${title}`, '', '| Key | Artifacts | GB |', '| --- | ---: | ---: |',
    ...rows.slice(0, limit).map((row) => `| ${cell(row.key)} | ${row.count} | ${gb(row.bytes)} |`),
    ...(rows.length > limit ? [`| ${rows.length - limit} more | | |`] : []), '',
  ];
  return [
    '## Actions storage cleanup', '',
    dryRun ? '**Dry run: nothing was deleted.**' : 'Selected artifacts and caches were deleted.', '',
    `- Stored artifacts before cleanup: ${summary.count} (${gb(summary.bytes)} GB).`,
    `- Artifacts ${dryRun ? 'to delete' : 'deleted'}: ${summary.deleteCount} (${gb(summary.deleteBytes)} GB).`,
    `- Caches ${dryRun ? 'to delete' : 'deleted'}: ${cacheDeletes.length} of ${cachePlan.length}.`,
    ...(unchecked > 0 ? [`- The run lookup limit was reached: ${unchecked} ${unchecked === 1 ? "artifact wasn't" : "artifacts weren't"} checked and wait for the next run.`] : []),
    ...(deferred > 0 ? [`- The delete limit was reached: ${deferred} selected ${deferred === 1 ? 'item is' : 'items are'} left for the next run.`] : []), '',
    ...table('Stored artifacts by name prefix', summary.byPrefix),
    ...table('Stored artifacts by branch', summary.byBranch),
  ].join('\n');
}

const isNotFound = (error) => error?.status === 404;

/** Plans and, unless `dryRun`, applies the cleanup through `api` (`get(path)`, `del(path)`). */
export async function runCleanup({ api, now = Date.now(), dryRun, maxDeletes = 400, maxRunLookups = 200, policy = DEFAULT_POLICY, log = () => {} }) {
  const artifacts = await collectPages(api.get, 'actions/artifacts', 'artifacts');
  const pulls = await collectPages(api.get, 'pulls?state=all', null);
  const branches = (await collectPages(api.get, 'branches', null)).map((branch) => branch.name);
  const caches = await collectPages(api.get, 'actions/caches', 'actions_caches');

  const runs = new Map();
  const getRun = async (id) => {
    if (!runs.has(id)) {
      if (runs.size >= maxRunLookups) return RUN_NOT_CHECKED;
      runs.set(id, await api.get(`actions/runs/${id}`).catch((error) => {
        if (isNotFound(error)) return undefined;
        throw error;
      }));
    }
    return runs.get(id);
  };
  const artifactPlan = await planArtifacts(artifacts, { pulls, getRun, now, policy });
  const cachePlan = planCaches(caches, { branches, pulls, policy });

  const deleted = { artifacts: 0, caches: 0 };
  let deferred = 0;
  const remove = async (kind, path, line) => {
    log(`${dryRun ? 'would delete' : 'delete'} ${line}`);
    if (dryRun) return;
    if (deleted.artifacts + deleted.caches >= maxDeletes) { deferred += 1; return; }
    try { await api.del(path); } catch (error) { if (!isNotFound(error)) throw error; }
    deleted[kind] += 1;
  };
  for (const { artifact, action, reason } of artifactPlan) {
    if (action !== 'delete') continue;
    await remove('artifacts', `actions/artifacts/${artifact.id}`, `artifact ${artifact.id} ${artifact.name} (${artifact.workflow_run?.head_branch}, ${reason})`);
  }
  for (const { cache, action, reason } of cachePlan) {
    if (action !== 'delete') continue;
    await remove('caches', `actions/caches/${cache.id}`, `cache ${cache.id} ${cache.ref} (${reason})`);
  }
  return { artifactPlan, cachePlan, deleted, deferred, markdown: renderSummary({ artifactPlan, cachePlan, dryRun, deferred }) };
}

/** A minimal GitHub REST client for one repository; `get('')` reads the repository itself. The token stays in the request header. */
export function githubApi({ token, repository, apiUrl = 'https://api.github.com', fetchImpl = fetch }) {
  const call = async (method, path) => {
    const response = await fetchImpl(`${apiUrl}/repos/${repository}${path ? `/${path}` : ''}`, {
      method,
      redirect: 'error',
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'actions-cleanup' },
    });
    if (!response.ok) {
      const error = new Error(`${method} ${path}: HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.status === 204 ? null : response.json();
  };
  return { get: (path) => call('GET', path), del: (path) => call('DELETE', path) };
}

async function main(argv, env) {
  const token = env.GITHUB_TOKEN;
  const repository = env.GITHUB_REPOSITORY;
  if (!token || !repository) throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY are required');
  const dryRun = argv.includes('--dry-run') || /^(true|1|yes)$/i.test(env.DRY_RUN ?? '');
  const limit = (name) => {
    if (!env[name]) return undefined;
    const value = Number(env[name]);
    if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a whole number`);
    return value;
  };
  const maxDeletes = limit('MAX_DELETES');
  const maxRunLookups = limit('MAX_RUN_LOOKUPS');
  const api = githubApi({ token, repository, apiUrl: env.GITHUB_API_URL || undefined });
  const defaultBranch = env.DEFAULT_BRANCH || (await api.get('')).default_branch;
  if (!defaultBranch) throw new Error('could not read the default branch; set DEFAULT_BRANCH');
  const policy = { ...DEFAULT_POLICY, defaultBranch };
  const result = await runCleanup({ api, dryRun, maxDeletes, maxRunLookups, policy, log: (line) => console.log(line) });
  console.log(result.markdown);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${result.markdown}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2), process.env).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
