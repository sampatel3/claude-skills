# claude-skills

Claude Code skills that belong to no single project.

A skill that serves one repo belongs in that repo, in its own `.claude/skills/`
directory, committed — Claude Code discovers it whenever you work there, with no
symlink and no per-machine setup, and everyone who clones the repo gets it.

This repo is for the other kind: a skill that has to apply in every repo and
every conversation, which means it cannot live inside any one of them.

## Skills

- **`google-dev-writing`** — the whole [Google developer documentation style
  guide](https://developers.google.com/style) as a skill: voice and tone, global
  audience, active voice, present tense, second person, timeless writing,
  punctuation, abbreviations, capitalisation, text formatting, headings, lists,
  procedures, notices, numbers, dates, tables, links, images, accessibility and
  inclusive language. It governs every word written for a person to read, and
  never touches code, identifiers, command output or quoted material.

  A project's own writing rules go on top of it and win — the order Google's own
  guide sets. Where a project skill disagrees with it, list the disagreements
  rather than leaving them to be re-argued. The skill ends with the list for the
  project it came from, as a worked example.

- **`local-first-ci`** — the standard for GitHub Actions that keeps minutes and
  artifact storage small: jobs on self-hosted runners chosen by a repository
  variable, with GitHub-hosted runners as the fallback; cancelled superseded
  runs; three-day pull request artifacts; heavy diagnostics uploaded only on
  failure; a daily artifact and cache cleanup; a runner image matched to
  `ubuntu-24.04`; and architecture-aware tool downloads. It ships templates for
  the cleanup workflow and script, the runner kit, and the workflow snippets.

## Install

```bash
./install.sh
```

Symlinks each skill into `~/.claude/skills/`. Re-runnable; it only ever replaces
a symlink it already owns.

A skill in `~/.claude/skills/` is *available* everywhere, which is not the same
as being used — a model reaches for an available skill when it happens to think
of one. To make a skill binding, name it in `~/.claude/CLAUDE.md`, which loads
into every session. `google-dev-writing` is named there under "Writing — always
on, every project, every chat".
