#!/usr/bin/env bash
# Symlink every skill in this repo into ~/.claude/skills, so Claude Code finds
# them in every project on this machine.
#
# Safe to re-run. It replaces a symlink it already owns and refuses anything
# else, so a real directory that happens to share a name is never destroyed.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dest="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills"
mkdir -p "$dest"

for src in "$repo"/skills/*/; do
  name="$(basename "$src")"
  link="$dest/$name"

  if [ -e "$link" ] && [ ! -L "$link" ]; then
    echo "refusing $name — $link exists and is not a symlink" >&2
    exit 1
  fi

  ln -sfn "${src%/}" "$link"
  echo "linked $name -> ${src%/}"
done
