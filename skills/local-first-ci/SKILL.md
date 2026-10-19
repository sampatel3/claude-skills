---
name: local-first-ci
description: The local-first CI standard for GitHub Actions — jobs on self-hosted runners selected by a repository variable with a hosted fallback, cancelled superseded runs, short artifact retention, failure-only heavy uploads, a daily artifact and cache cleanup, a runner image matched to ubuntu-24.04, architecture-aware tool downloads, and a budget alert. Use it when you set up or change CI in any repository, when Actions minutes, artifact storage or billing become a problem, when a job fails only on a self-hosted or ARM64 runner, or when many agents push to one repository. Ships templates for every part.
---

# Local-first CI

GitHub Actions bills hosted-runner minutes and artifact storage. Both grow quietly
until they stop CI. This standard runs CI on your own runners first, keeps
GitHub-hosted runners one variable away, and keeps stored artifacts small.

It comes from a project whose Actions use was blocked by billing in October 2026,
for two reasons:

- **Artifact storage.** The account held 142 GB of artifacts at the default 90-day
  retention. Of that, 110 GB came from pull request runs that later pushes had
  already replaced, and a single quality receipt was about 107 MB.
- **CI storms.** Many agents pushed to the same repository. Each push started
  about 25 jobs, roughly 67 job-minutes, and nothing cancelled the run that the
  next push replaced.

## When to use this skill

Use this skill in any of the following situations:

- You create a repository's CI, or add a workflow to one.
- Actions minutes, artifact storage, or the Actions bill grow, or GitHub blocks
  Actions for billing.
- Several agents or people push to one repository, and runs pile up.
- A job passes on GitHub-hosted runners and fails on a self-hosted runner, or the
  reverse.
- You move runners from a laptop to a virtual machine (VM).

## The standard

A repository meets the standard when it does all of the following.

### Select the runner with a repository variable

Every job declares this `runs-on` value:

```yaml
runs-on: ${{ vars.CI_RUNS_ON || 'ubuntu-24.04' }}
```

The repository variable `CI_RUNS_ON` selects the runners:

| `CI_RUNS_ON` | Where jobs run |
|---|---|
| `local-ci` | The self-hosted runners from the kit. Every kit runner carries this label. |
| Not set | GitHub-hosted `ubuntu-24.04` runners, which use the account's Actions minutes. |

The fallback is the whole point of the variable: deleting it moves every job back
to hosted runners with no workflow change. That only works if the self-hosted
image matches `ubuntu-24.04` (see [Match the runner image to the hosted
runners](#match-the-runner-image-to-the-hosted-runners)).

Jobs that deploy to production, or hold production credentials, don't read the
variable. Keep them on GitHub-hosted runners.

### Cancel superseded pull request runs

Put this block at the top level of every workflow that runs on `pull_request`
(`templates/snippets/concurrency.yml`):

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.pull_request.number) || format('run-{0}', github.run_id) }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

A new push to a pull request cancels that pull request's older run of the same
workflow. A push to the default branch, a manual run, and a scheduled run each
get a group of their own, so they're never cancelled or replaced. Don't add
cancelling concurrency to a deploy workflow.

### Keep pull request artifacts for three days

Every `actions/upload-artifact` step sets:

```yaml
retention-days: ${{ github.event_name == 'pull_request' && 3 || 90 }}
```

Also lower the repository's default retention, which applies to any upload that
doesn't set its own. In the repository, click **Settings > Actions > General**
and set **Artifact and log retention**. To set it from the command line, run:

```bash
gh api --method PUT repos/OWNER/REPO/actions/permissions/artifact-and-log-retention -F days=14
```

### Upload heavy diagnostics only on failure

Split each job's upload in two (`templates/snippets/upload-pair.yml`):

- Receipts, results, and logs upload on every run, with `if: ${{ always() }}`.
  Exclude report and trace folders from this upload.
- HTML reports, traces, screenshots, and videos upload in a separate
  `*-failure-diagnostics` artifact with `if: ${{ failure() }}`.

Keep a heavy folder in the always-on upload only when something downstream reads
it from a passing run, and write down why in a comment beside the step.

### Clean up artifacts and caches every day

Copy `templates/github/workflows/actions-cleanup.yml` and
`templates/github/scripts/actions-cleanup.mjs` (with its tests) into `.github/`.
The workflow runs the script every day at 03:17 UTC, and a manual run is a dry
run by default. The script does the following:

- It never deletes an artifact from a default-branch run.
- It deletes artifacts from `pull_request` and `push` runs on other branches when
  their pull request is closed or merged, or after 48 hours.
- It keeps artifacts from dispatched, scheduled, and chained runs until their own
  retention ends, so an operator flow never loses an artifact it still reads.
- It deletes caches whose branch is deleted or whose pull request is closed.
- It writes a job summary of stored artifacts by name prefix and by branch.

It makes at most 200 run lookups and 400 deletions a run, so it stays inside the
workflow token's limit of 1,000 API requests an hour. A backlog clears over
several days. To run the tests, run `node --test .github/scripts/actions-cleanup.node-tests.mjs`.

### Match the runner image to the hosted runners

The self-hosted image (`templates/ci-runners/runner-image/Dockerfile`) starts
from `myoung34/github-runner:ubuntu-noble` and installs the major versions that
GitHub's `ubuntu-24.04` image has: Ubuntu 24.04, Python 3.12, OpenSSL 3, and
Node 24, plus `jq`, `unzip`, `git`, and a compiler toolchain. An older image fails
jobs for reasons that have nothing to do with the change under test. For example,
Node 10 can't load an ES module, Python 3.8 rejects newer syntax, and OpenSSL 1.1
refuses some certificates.

When a workflow needs a tool that `ubuntu-24.04` has and the image lacks, add it
to the Dockerfile, not to the workflow. Then run `./register.sh` again; it
rebuilds the image and recreates only a runner whose image changed.

### Download tools for the runner's architecture

GitHub-hosted runners are x86-64. A runner in Colima on an Apple silicon Mac is
ARM64. Check each workflow against the following list:

- Every `curl` or `wget` of a prebuilt binary picks its asset from `RUNNER_ARCH`
  (`X64` or `ARM64`) and checks the SHA-256 for that asset
  (`templates/snippets/arch-aware-download.yml`). A single hard-coded `amd64` or
  `x86_64` URL is the most common failure.
- `actions/setup-node`, `actions/setup-python`, `actions/setup-go`, and similar
  actions already choose the right build. Prefer them to a hand-written download.
- A tool installed into the image uses `dpkg --print-architecture` (`amd64` or
  `arm64`), as the Dockerfile's Node install does.
- A job that builds a `linux/amd64` image for deployment on an ARM64 runner needs
  QEMU emulation through `binfmt` on the Docker host, and passes
  `--platform linux/amd64` to the build.
- A tool installs into `$RUNNER_TEMP` and joins `$GITHUB_PATH`, rather than
  writing to `/usr/local/bin`, which the runner user might not own.

### Set a budget alert

Set an Actions budget so that the bill can't grow unnoticed. On GitHub, click
your profile picture, then **Settings > Billing and licensing > Budgets and
alerts**, and create a budget for Actions with an alert at 75%, 90%, and 100%.
Decide whether reaching the budget stops usage; with the self-hosted runners as
the default, stopping hosted usage is usually what you want.

### Push less

The cheapest run is the one that doesn't start. This matters most when agents
push:

- Run the focused tests for the change locally before you push, and push when a
  piece of work is done, not after every commit.
- Batch a series of small pull requests into a merge train instead of rebasing and
  pushing each one after every merge.
- Don't push to a pull request only to re-trigger CI. Rerun the failed job.

## Adopt the standard in a repository

To adopt the standard, follow these steps:

1. Read the repository's workflows and list every job, every upload, and every
   tool download. Note any job that deploys or holds production credentials.
1. In each workflow, change `runs-on` to the variable form, except for the
   production jobs from step 1.
1. Add the concurrency block to each pull request workflow.
1. Add `retention-days` to each upload, and split heavy uploads into the pair.
1. Fix each architecture-specific download from the checklist.
1. Copy the cleanup workflow, the script, and its tests into `.github/`. Change
   the `runs-on` variable name if the repository uses another one.
1. Copy `templates/ci-runners/` into the repository, for example to
   `deployment/ci-runners/`. In `kit.env`, set `RUNNER_REPO`, `RUNNER_PREFIX`,
   and the leaked-container patterns `LEAK_LABELS` and `LEAK_IMAGES` that the
   repository's tests leave behind.
1. Open one pull request with these changes. While `CI_RUNS_ON` isn't set, its
   checks run on hosted runners, which proves the fallback.
1. After the pull request merges, start the runner from the kit directory:

   ```bash
   ./register.sh
   ```

   The script needs the `gh` CLI signed in as a repository administrator and a
   running Docker context (Colima on a Mac). It writes a one-hour registration
   token to `.runner.env` with mode `0600`, builds the image, starts
   `runner-ci-1`, and deletes the file.

1. Check that the runner is online with the `local-ci` label:

   ```bash
   gh api repos/OWNER/REPO/actions/runners \
     --jq '.runners[] | [.name, .status, ([.labels[].name] | join(","))] | @tsv'
   ```

1. Select the self-hosted runners:

   ```bash
   gh variable set CI_RUNS_ON --repo OWNER/REPO --body local-ci
   ```

1. Schedule host maintenance. On a Mac, write the LaunchAgent from the kit
   directory, with a label unique to the repository:

   ```bash
   label=com.example.myrepo-runner-maintenance
   sed -e "s|__LABEL__|$label|g" -e "s|__KIT_DIR__|$PWD|g" -e "s|__HOME__|$HOME|g" \
     launchd/runner-maintenance.plist > ~/Library/LaunchAgents/$label.plist
   launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/$label.plist
   ```

   On a Linux VM, install the units in `systemd/` instead.

1. Run the cleanup once as a dry run, read its plan, and then let the schedule
   take over:

   ```bash
   gh workflow run actions-cleanup.yml --repo OWNER/REPO -f dry_run=true
   ```

1. Set the budget alert, if the account doesn't have one.

`host-maintenance.sh` removes only what CI leaves behind, because other projects
share the Docker host: dangling images and build cache older than 24 hours,
unused anonymous volumes older than 24 hours, and leaked test containers that
match `LEAK_LABELS` or `LEAK_IMAGES`. It never runs `docker system prune`. To see
what it would remove, run `./host-maintenance.sh --dry-run`.

To clear a large artifact backlog faster than the daily run, run the script on
your own machine with your `gh` sign-in, and read the dry run's plan before you
leave out `--dry-run`:

```bash
GITHUB_TOKEN="$(gh auth token)" GITHUB_REPOSITORY=OWNER/REPO \
  MAX_DELETES=2000 MAX_RUN_LOOKUPS=1000 node .github/scripts/actions-cleanup.mjs --dry-run
```

## Fall back to hosted runners

To move every job back to GitHub-hosted runners, delete the variable:

```bash
gh variable delete CI_RUNS_ON --repo OWNER/REPO
```

Queued and new jobs then run on `ubuntu-24.04`. To return to the self-hosted
runners, set the variable to `local-ci` again. Fall back when the runner host is
down for longer than a few hours, when a release can't wait for a sleeping
laptop, or when a job needs more memory than the host has.

## Pitfalls

- **The image drifts from `ubuntu-24.04`.** A runner image built on an older base,
  or one missing a tool, fails jobs that pass on hosted runners. Change the
  Dockerfile, never the workflow, so the fallback keeps working.
- **ARM64 gets x86-64 binaries.** A Mac runner is ARM64. Any download that
  ignores `RUNNER_ARCH` fails there, often with `Exec format error` or a checksum
  mismatch.
- **More than one runner on a laptop.** Runners on one Colima VM share its
  memory with each other and with other projects' containers. Start one runner;
  start `runner-ci-2` only on a host with memory to spare, such as a VM.
- **The API rate limit.** A personal token allows 5,000 core API requests an
  hour, shared by every tool that uses it, including `gh`, agents, and consoles.
  The workflow token allows 1,000 an hour for each repository. Bulk artifact
  deletion makes one request for each artifact, so throttle it with
  `MAX_DELETES` and `MAX_RUN_LOOKUPS`, and spread a backlog over several runs.
- **A Railway service created with a user session.** A `serviceCreate` call made
  with a personal Railway session creates the service in every environment of
  the project that isn't a fork, production included. Create runner or CI
  services with an environment-scoped token, or in a forked environment.
- **The laptop sleeps.** While the Mac sleeps, the runner goes offline and jobs
  queue. A job queued for more than 24 hours fails, and a job running when the
  Mac sleeps usually fails. Rerun it after the Mac wakes, or run `caffeinate -s`
  during a long merge train.
- **Self-hosted runners on a public repository.** A pull request from a fork runs
  its own code on your runner. Use self-hosted runners only on private
  repositories, or require approval for fork pull requests.
- **A runner name registered twice.** Registering a runner name that already
  exists replaces that runner. Give runners on a second host new names, through
  a different `RUNNER_PREFIX`.

## Templates

The `templates/` directory holds everything the steps copy:

| Path | Purpose |
|---|---|
| `github/workflows/actions-cleanup.yml` | The daily cleanup workflow, with a dry-run dispatch. |
| `github/scripts/actions-cleanup.mjs` | The cleanup rules and storage summary. |
| `github/scripts/actions-cleanup.node-tests.mjs` | Tests for the rules and the workflow's shape. |
| `snippets/runs-on.yml` | The variable-switched `runs-on`. |
| `snippets/concurrency.yml` | The concurrency block that cancels superseded pull request runs. |
| `snippets/upload-pair.yml` | The always-on upload and the failure-only diagnostics upload. |
| `snippets/arch-aware-download.yml` | A tool download that picks its asset from `RUNNER_ARCH`. |
| `ci-runners/kit.env` | The kit's settings: repository, prefix, Docker context, and leaked-container patterns. |
| `ci-runners/docker-compose.yml` | The runner containers. The default starts one runner. |
| `ci-runners/runner-image/Dockerfile` | The runner image, matched to `ubuntu-24.04`. |
| `ci-runners/register.sh` | Fetches a registration token and starts the named runners. |
| `ci-runners/host-maintenance.sh` | Removes stale Docker data and leaked test containers, and reports disk use. |
| `ci-runners/launchd/runner-maintenance.plist` | Runs host maintenance daily on macOS. |
| `ci-runners/systemd/` | Optional. The same schedule on a Linux VM. |
