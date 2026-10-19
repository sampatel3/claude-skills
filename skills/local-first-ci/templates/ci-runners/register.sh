#!/usr/bin/env bash
# Registers and starts this repository's self-hosted runners from docker-compose.yml.
# Template from the local-first-ci skill. Settings are in kit.env.
#
#   ./register.sh                 # the default runner, runner-ci-1
#   ./register.sh runner-ci-2     # one or more named services, including opt-in profiles
#
# It asks GitHub for a registration token with the signed-in gh CLI (repository admin), writes
# it to .runner.env with mode 0600, builds the runner image from runner-image/Dockerfile, starts
# the services, and deletes the file on exit. The token is never printed or passed on a command
# line, and it expires after one hour. A runner that is already registered keeps its
# registration in its named volume and ignores the token.
set -euo pipefail

cd "$(dirname "$0")"
context_from_env="${RUNNER_DOCKER_CONTEXT:-}"
set -a; . ./kit.env; set +a
context="${context_from_env:-${RUNNER_DOCKER_CONTEXT:-colima}}"
if [ "$RUNNER_REPO" = "owner/name" ] || [ "$RUNNER_PREFIX" = "myrepo" ]; then
  echo "register.sh: set RUNNER_REPO and RUNNER_PREFIX in kit.env first" >&2; exit 1
fi
env_file=.runner.env
services=("$@")
if [ "${#services[@]}" -eq 0 ]; then services=(runner-ci-1); fi

command -v gh >/dev/null || { echo "register.sh: install and sign in to the gh CLI first" >&2; exit 1; }
docker --context "$context" info >/dev/null 2>&1 || { echo "register.sh: Docker context '$context' isn't reachable; start Colima first" >&2; exit 1; }

umask 077
trap 'rm -f "$env_file"' EXIT
token="$(gh api --method POST "repos/$RUNNER_REPO/actions/runners/registration-token" --jq .token)"
test -n "$token" || { echo "register.sh: GitHub returned no registration token" >&2; exit 1; }
printf 'RUNNER_TOKEN=%s\n' "$token" > "$env_file"
unset token
chmod 600 "$env_file"

docker --context "$context" compose --env-file kit.env up --detach --build "${services[@]}"
docker --context "$context" compose --env-file kit.env ps "${services[@]}"
