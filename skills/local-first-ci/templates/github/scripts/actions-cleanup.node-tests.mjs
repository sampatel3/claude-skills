// Local-first CI: the daily Actions storage cleanup. Run with `node --test` on this file.
// These cases drive the selection rules with a fake GitHub API: the default branch is always kept, the 48-hour cutoff, closed pull requests,
// runs that are neither pull_request nor push, deleted-branch caches, dry run and pagination.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  DEFAULT_POLICY,
  artifactPrefix,
  collectPages,
  planArtifacts,
  planCaches,
  runCleanup,
  summarize,
} from './actions-cleanup.mjs';

const NOW = Date.parse('2026-10-19T12:00:00Z');
const hoursAgo = (hours) => new Date(NOW - hours * 3_600_000).toISOString();
const sha = (n) => String(n).padStart(40, 'a');

let nextId = 1;
function artifact({ name = 'quality-pr-head-receipt', branch, hours, runId = 100, bytes = 1_000_000, expired = false } = {}) {
  const id = nextId++;
  return {
    id, name, size_in_bytes: bytes, expired, created_at: hoursAgo(hours),
    workflow_run: { id: runId, head_branch: branch, head_sha: sha(runId) },
  };
}
const pull = (number, ref, state) => ({ number, state, head: { ref } });
const run = (id, event, head_branch) => ({ id, event, head_branch });

/** A fake GitHub API that serves pages of 100 and records every call. */
function fakeApi({ artifacts = [], pulls = [], branches = [], caches = [], runs = [], missingOnDelete = [] } = {}) {
  const calls = [];
  const page = (items, path) => {
    const number = Number(/[?&]page=(\d+)/.exec(path)?.[1] ?? 1);
    assert.match(path, /[?&]per_page=100(&|$)/);
    return items.slice((number - 1) * 100, number * 100);
  };
  const byRun = new Map(runs.map((r) => [r.id, r]));
  return {
    calls,
    async get(path) {
      calls.push(['GET', path]);
      if (path.startsWith('actions/artifacts?')) return { total_count: artifacts.length, artifacts: page(artifacts, path) };
      if (path.startsWith('actions/caches?')) return { total_count: caches.length, actions_caches: page(caches, path) };
      if (path.startsWith('pulls?')) return page(pulls, path);
      if (path.startsWith('branches?')) return page(branches.map((name) => ({ name })), path);
      const runMatch = /^actions\/runs\/(\d+)$/.exec(path);
      if (runMatch) {
        const found = byRun.get(Number(runMatch[1]));
        if (!found) { const error = new Error('Not Found'); error.status = 404; throw error; }
        return found;
      }
      throw new Error(`unexpected GET ${path}`);
    },
    async del(path) {
      calls.push(['DELETE', path]);
      if (missingOnDelete.includes(path)) { const error = new Error('Not Found'); error.status = 404; throw error; }
    },
  };
}
const deletes = (api) => api.calls.filter(([method]) => method === 'DELETE').map(([, path]) => path);

test('never deletes an artifact from a default-branch run, however old', async () => {
  const old = artifact({ branch: 'main', hours: 24 * 80, runId: 1 });
  const plan = await planArtifacts([old], { pulls: [], getRun: async () => run(1, 'push', 'main'), now: NOW });
  assert.equal(plan[0].action, 'keep');
  assert.equal(plan[0].reason, 'default-branch');
});

test('keeps a non-default-branch artifact up to 48 hours and deletes it after', async () => {
  const young = artifact({ branch: 'claude/feature', hours: 47, runId: 2 });
  const old = artifact({ branch: 'claude/feature', hours: 49, runId: 3 });
  const plan = await planArtifacts([young, old], {
    pulls: [pull(7, 'claude/feature', 'open')],
    getRun: async (id) => run(id, 'pull_request', 'claude/feature'),
    now: NOW,
  });
  assert.deepEqual(plan.map((entry) => [entry.action, entry.reason]), [['keep', 'recent'], ['delete', 'older-than-48h']]);
});

test('deletes artifacts from a closed or merged pull request at any age', async () => {
  const merged = artifact({ branch: 'claude/merged', hours: 1, runId: 4 });
  const plan = await planArtifacts([merged], {
    pulls: [pull(8, 'claude/merged', 'closed')],
    getRun: async (id) => run(id, 'pull_request', 'claude/merged'),
    now: NOW,
  });
  assert.equal(plan[0].action, 'delete');
  assert.equal(plan[0].reason, 'closed-pull-request');
});

test('an open pull request on a branch outweighs an older closed one', async () => {
  const fresh = artifact({ branch: 'claude/reopened', hours: 2, runId: 5 });
  const plan = await planArtifacts([fresh], {
    pulls: [pull(9, 'claude/reopened', 'closed'), pull(10, 'claude/reopened', 'open')],
    getRun: async (id) => run(id, 'pull_request', 'claude/reopened'),
    now: NOW,
  });
  assert.equal(plan[0].action, 'keep');
});

test('keeps artifacts from dispatched or chained runs, such as an operator broker branch', async () => {
  const dispatched = artifact({ name: 'envelope', branch: 'release-broker-abc', hours: 72, runId: 6 });
  const plan = await planArtifacts([dispatched], { pulls: [], getRun: async (id) => run(id, 'workflow_dispatch', 'release-broker-abc'), now: NOW });
  assert.equal(plan[0].action, 'keep');
  assert.equal(plan[0].reason, 'not-a-pull-request-or-push-run');
});

test('keeps an artifact whose run cannot be read, and skips expired artifacts', async () => {
  const orphan = artifact({ branch: 'gone', hours: 72, runId: 7 });
  const expired = artifact({ branch: 'gone', hours: 72, runId: 8, expired: true });
  const plan = await planArtifacts([orphan, expired], { pulls: [], getRun: async () => undefined, now: NOW });
  assert.deepEqual(plan.map((entry) => [entry.action, entry.reason]), [['keep', 'run-unreadable'], ['keep', 'expired']]);
});

test('reads every page of a listing', async () => {
  const many = Array.from({ length: 250 }, (_, n) => artifact({ branch: 'main', hours: 1, runId: 1000 + n }));
  const api = fakeApi({ artifacts: many });
  const collected = await collectPages(api.get, 'actions/artifacts', 'artifacts');
  assert.equal(collected.length, 250);
  assert.deepEqual(api.calls.map(([, path]) => path), [
    'actions/artifacts?per_page=100&page=1',
    'actions/artifacts?per_page=100&page=2',
    'actions/artifacts?per_page=100&page=3',
  ]);
});

test('a listing that fills its last page exactly ends on the empty page after it', async () => {
  const api = fakeApi({ pulls: Array.from({ length: 200 }, (_, n) => pull(n + 1, `b${n}`, 'closed')) });
  const collected = await collectPages(api.get, 'pulls?state=all', null);
  assert.equal(collected.length, 200);
  assert.equal(api.calls.length, 3);
  assert.equal(api.calls[0][1], 'pulls?state=all&per_page=100&page=1');
});

test('selects caches for deleted branches and closed pull requests only', () => {
  const caches = [
    { id: 1, ref: 'refs/heads/main', size_in_bytes: 10 },
    { id: 2, ref: 'refs/heads/claude/live', size_in_bytes: 10 },
    { id: 3, ref: 'refs/heads/claude/deleted', size_in_bytes: 10 },
    { id: 4, ref: 'refs/pull/11/merge', size_in_bytes: 10 },
    { id: 5, ref: 'refs/pull/12/merge', size_in_bytes: 10 },
    { id: 6, ref: 'refs/tags/v1', size_in_bytes: 10 },
  ];
  const plan = planCaches(caches, { branches: ['main', 'claude/live'], pulls: [pull(11, 'x', 'open'), pull(12, 'y', 'closed')] });
  assert.deepEqual(plan.map((entry) => [entry.cache.id, entry.action]), [
    [1, 'keep'], [2, 'keep'], [3, 'delete'], [4, 'keep'], [5, 'delete'], [6, 'keep'],
  ]);
});

test('a dry run plans deletions and deletes nothing', async () => {
  const api = fakeApi({
    artifacts: [artifact({ branch: 'claude/old', hours: 100, runId: 20 })],
    caches: [{ id: 30, ref: 'refs/heads/claude/old', size_in_bytes: 5 }],
    runs: [run(20, 'pull_request', 'claude/old')],
  });
  const result = await runCleanup({ api, now: NOW, dryRun: true });
  assert.equal(result.artifactPlan[0].action, 'delete');
  assert.equal(result.cachePlan[0].action, 'delete');
  assert.deepEqual(deletes(api), []);
  assert.match(result.markdown, /Dry run: nothing was deleted/);
});

test('a real run deletes each selected artifact and cache once, and treats an already-gone one as deleted', async () => {
  const stale = artifact({ branch: 'claude/old', hours: 100, runId: 21 });
  const gone = artifact({ branch: 'claude/old', hours: 100, runId: 21 });
  const kept = artifact({ branch: 'main', hours: 100, runId: 22 });
  const api = fakeApi({
    artifacts: [stale, gone, kept],
    branches: ['main'],
    caches: [{ id: 31, ref: 'refs/heads/claude/old', size_in_bytes: 5 }, { id: 32, ref: 'refs/heads/main', size_in_bytes: 5 }],
    runs: [run(21, 'pull_request', 'claude/old'), run(22, 'push', 'main')],
    missingOnDelete: [`actions/artifacts/${gone.id}`],
  });
  const result = await runCleanup({ api, now: NOW, dryRun: false });
  assert.deepEqual(deletes(api), [`actions/artifacts/${stale.id}`, `actions/artifacts/${gone.id}`, 'actions/caches/31']);
  assert.equal(result.deleted.artifacts, 2);
  assert.equal(result.deleted.caches, 1);
  // One run lookup serves both artifacts from run 21; the default-branch artifact needs none.
  assert.deepEqual(api.calls.filter(([, path]) => path.startsWith('actions/runs/')).map(([, path]) => path), ['actions/runs/21']);
});

test('stops after the delete limit and leaves the rest for the next run', async () => {
  const stale = [1, 2, 3].map(() => artifact({ branch: 'claude/old', hours: 100, runId: 23 }));
  const api = fakeApi({ artifacts: stale, branches: ['main'], runs: [run(23, 'pull_request', 'claude/old')] });
  const result = await runCleanup({ api, now: NOW, dryRun: false, maxDeletes: 2 });
  assert.equal(deletes(api).length, 2);
  assert.equal(result.deleted.artifacts, 2);
  assert.equal(result.deferred, 1);
  assert.match(result.markdown, /1 selected item is left for the next run/);
});

test('stops reading runs after the lookup limit and keeps the unchecked artifacts for the next run', async () => {
  const first = artifact({ branch: 'claude/a', hours: 100, runId: 24 });
  const second = artifact({ branch: 'claude/b', hours: 100, runId: 25 });
  const api = fakeApi({ artifacts: [first, second], runs: [run(24, 'pull_request', 'claude/a'), run(25, 'pull_request', 'claude/b')] });
  const result = await runCleanup({ api, now: NOW, dryRun: false, maxRunLookups: 1 });
  assert.deepEqual(deletes(api), [`actions/artifacts/${first.id}`]);
  assert.deepEqual(result.artifactPlan.map((entry) => entry.reason), ['older-than-48h', 'run-not-checked']);
  assert.match(result.markdown, /1 artifact wasn't checked/);
});

test('groups the storage summary by name prefix and by branch', async () => {
  const plan = await planArtifacts([
    artifact({ name: `install-receipt-${sha(1)}`, branch: 'main', hours: 1, bytes: 2e9 }),
    artifact({ name: `install-receipt-${sha(2)}`, branch: 'main', hours: 1, bytes: 1e9 }),
    artifact({ name: 'deploy-evidence-3', branch: 'main', hours: 1, bytes: 5e8 }),
  ], { pulls: [], getRun: async () => undefined, now: NOW });
  const summary = summarize(plan);
  assert.equal(summary.count, 3);
  assert.equal(summary.bytes, 3.5e9);
  assert.deepEqual(summary.byPrefix.map((row) => [row.key, row.count, row.bytes]), [
    ['install-receipt', 2, 3e9], ['deploy-evidence', 1, 5e8],
  ]);
  assert.deepEqual(summary.byBranch.map((row) => [row.key, row.count]), [['main', 3]]);
  assert.equal(artifactPrefix('quality-pr-head-receipt'), 'quality-pr-head-receipt');
});

test('a policy with another default branch keeps that branch's artifacts', async () => {
  const trunk = artifact({ branch: 'trunk', hours: 24 * 80, runId: 40 });
  const plan = await planArtifacts([trunk], { pulls: [], getRun: async () => run(40, 'push', 'trunk'), now: NOW, policy: { ...DEFAULT_POLICY, defaultBranch: 'trunk' } });
  assert.equal(plan[0].reason, 'default-branch');
});

test('the workflow runs daily and on dispatch with a dry-run input, on the selected runner, with least privilege', () => {
  const text = readFileSync(new URL('../workflows/actions-cleanup.yml', import.meta.url), 'utf8');
  assert.match(text, /^  schedule:\n    - cron: '[^']+'$/m);
  assert.match(text, /^  workflow_dispatch:\n    inputs:\n      dry_run:[\s\S]*?type: boolean/m);
  assert.match(text, /^permissions:\n  actions: write\n  contents: read\n  pull-requests: read\n\n/m);
  assert.equal(text.match(/^  [a-z-]+:\n    runs-on:/gm)?.length, 1);
  assert.match(text, /runs-on: \$\{\{ vars\.CI_RUNS_ON \|\| 'ubuntu-24\.04' \}\}/);
  assert.match(text, /node \.github\/scripts\/actions-cleanup\.mjs/);
  assert.doesNotMatch(text, /continue-on-error/);
  assert.doesNotMatch(text, /secrets\./);
});
