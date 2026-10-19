#!/usr/bin/env bash
# Daily maintenance for the Docker host that runs this repository's CI runners.
# Template from the local-first-ci skill. Settings are in kit.env.
#
#   ./host-maintenance.sh [--dry-run]
#
# The host is shared with other projects' containers, so every removal is narrow:
#   - dangling images and build cache older than 24 hours;
#   - anonymous volumes that no container uses, older than 24 hours. Named volumes, which other
#     projects keep on purpose, and volumes labelled ci-runners.keep=true are never removed;
#   - leaked test containers older than LEAK_HOURS (default 6): containers with one of the
#     LEAK_LABELS, and containers from one of the LEAK_IMAGES that no Compose project owns.
# It ends with a disk usage report. It never runs `docker system prune`, which would also remove
# other projects' stopped containers and networks.
set -euo pipefail

kit_dir="$(cd "$(dirname "$0")" && pwd)"
context_from_env="${RUNNER_DOCKER_CONTEXT:-}"
set -a; . "$kit_dir/kit.env"; set +a
context="${context_from_env:-${RUNNER_DOCKER_CONTEXT:-colima}}"
leak_hours="${LEAK_HOURS:-6}"
read -r -a leak_labels <<< "${LEAK_LABELS:-}"
read -r -a leak_images <<< "${LEAK_IMAGES:-}"
dry_run=false
if [ "${1:-}" = "--dry-run" ]; then dry_run=true; fi

d() { docker --context "$context" "$@"; }
act() {
  if "$dry_run"; then echo "would run: docker $*"; else d "$@"; fi
}

# Seconds since the epoch for a Docker RFC 3339 timestamp, such as 2026-10-19T12:27:48+04:00 or
# 2026-10-19T08:27:48.123456789Z. The Docker host's time zone can differ from UTC, so the offset
# counts. Works with BSD date (macOS) and GNU date (Linux).
epoch() {
  local stamp="${1:0:19}" zone seconds offset=0
  zone="$(printf '%s' "$1" | sed -E 's/^[0-9T:-]{19}(\.[0-9]+)?//')"
  seconds="$(date -u -j -f '%Y-%m-%dT%H:%M:%S' "$stamp" +%s 2>/dev/null || date -u -d "${stamp}Z" +%s)"
  if [[ "$zone" =~ ^([+-])([0-9]{2}):([0-9]{2})$ ]]; then
    offset=$(( 10#${BASH_REMATCH[2]} * 3600 + 10#${BASH_REMATCH[3]} * 60 ))
    if [ "${BASH_REMATCH[1]}" = "-" ]; then offset=$(( -offset )); fi
  fi
  echo $(( seconds - offset ))
}
older_than_hours() { [ $(( $(date -u +%s) - $(epoch "$1") )) -gt $(( $2 * 3600 )) ]; }

d info >/dev/null 2>&1 || { echo "host-maintenance: Docker context '$context' isn't reachable" >&2; exit 1; }
echo "host-maintenance: $(date -u +%Y-%m-%dT%H:%M:%SZ) repo=${RUNNER_REPO} context=$context dry_run=$dry_run"

echo "== Dangling images and build cache older than 24 hours"
act image prune --force --filter until=24h
act builder prune --force --filter until=24h

echo "== Unused anonymous volumes older than 24 hours"
while read -r volume; do
  [ -n "$volume" ] || continue
  [[ "$volume" =~ ^[0-9a-f]{64}$ ]] || continue
  if [ "$(d volume inspect --format '{{ index .Labels "ci-runners.keep" }}' "$volume")" = "true" ]; then continue; fi
  older_than_hours "$(d volume inspect --format '{{ .CreatedAt }}' "$volume")" 24 || continue
  act volume rm "$volume"
done < <(d volume ls --quiet --filter dangling=true)

echo "== Leaked test containers older than ${leak_hours} hours"
candidates() {
  local label image
  for label in ${leak_labels[@]+"${leak_labels[@]}"}; do d ps --all --quiet --filter "label=$label"; done
  for image in ${leak_images[@]+"${leak_images[@]}"}; do
    d ps --all --quiet --filter "ancestor=$image" | while read -r id; do
      [ -n "$id" ] || continue
      if [ -z "$(d inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$id")" ]; then echo "$id"; fi
    done
  done
}
while read -r id; do
  [ -n "$id" ] || continue
  older_than_hours "$(d inspect --format '{{ .Created }}' "$id")" "$leak_hours" || continue
  echo "leaked: $(d inspect --format '{{ .Name }} {{ .Config.Image }} {{ .State.Status }} created {{ .Created }}' "$id")"
  act rm --force --volumes "$id"
done < <(candidates | sort -u)

echo "== Disk usage"
d system df
if [ "$context" = "colima" ] && command -v colima >/dev/null; then
  colima ssh --profile "${RUNNER_COLIMA_PROFILE:-default}" -- df -h / /var/lib/docker
else
  df -h / /var/lib/docker
fi
