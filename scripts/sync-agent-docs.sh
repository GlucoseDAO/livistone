#!/usr/bin/env bash
# Keep AGENTS.md and CLAUDE.md byte-identical.
#
# The two files are one document under two names, so whichever one an author or an
# agent edited becomes the source and is copied over the other. When both were edited
# with different content there is no safe way to choose, so the script fails and asks
# for the edit to be made in one file.
#
# Run directly to sync the working tree; the pre-commit hook runs it with --staged so
# that what gets committed is consistent even when the working tree is not.
set -euo pipefail

A='AGENTS.md'
C='CLAUDE.md'

STAGED=0
if [ "${1-}" = '--staged' ]; then
  STAGED=1
fi

cd "$(git rev-parse --show-toplevel)"

# Content of a path as git sees it in a revision ('' means the index); empty if absent.
blob() {
  git show "$1:$2" 2>/dev/null || true
}

adopt() {
  local source="$1" target="$2"
  cp -- "$source" "$target"
  if [ "$STAGED" -eq 1 ]; then
    git add -- "$target"
  fi
  echo "sync-agent-docs: copied $source over $target"
}

changed_a=0
changed_c=0

if [ "$STAGED" -eq 1 ]; then
  # Only files already staged can be part of this commit.
  if [ -z "$(git diff --cached --name-only -- "$A" "$C")" ]; then
    exit 0
  fi
  index_a="$(blob '' "$A")"
  index_c="$(blob '' "$C")"
  if [ "$index_a" = "$index_c" ]; then
    exit 0
  fi
  # A file counts as edited when its staged content differs from the last commit.
  if [ "$index_a" != "$(blob HEAD "$A")" ]; then changed_a=1; fi
  if [ "$index_c" != "$(blob HEAD "$C")" ]; then changed_c=1; fi
  # Both names must always exist, so a missing twin is recreated from the other.
  if [ -n "$index_a" ] && [ -z "$index_c" ]; then adopt "$A" "$C"; exit 0; fi
  if [ -n "$index_c" ] && [ -z "$index_a" ]; then adopt "$C" "$A"; exit 0; fi
else
  if [ ! -f "$A" ] && [ ! -f "$C" ]; then
    echo "sync-agent-docs: neither $A nor $C exists" >&2
    exit 1
  fi
  if [ -f "$A" ] && [ -f "$C" ] && cmp -s -- "$A" "$C"; then
    exit 0
  fi
  if [ ! -f "$C" ]; then adopt "$A" "$C"; exit 0; fi
  if [ ! -f "$A" ]; then adopt "$C" "$A"; exit 0; fi
  if [ "$(cat -- "$A")" != "$(blob HEAD "$A")" ]; then changed_a=1; fi
  if [ "$(cat -- "$C")" != "$(blob HEAD "$C")" ]; then changed_c=1; fi
fi

if [ "$changed_a" -eq 1 ] && [ "$changed_c" -eq 1 ]; then
  cat >&2 <<MSG
sync-agent-docs: $A and $C were both edited and now differ.

  They are one document under two names, so only one can be the source.
  Put the intended text in one file, then:

      bun run docs:sync     # copies it over the other
      git add $A $C

  To see what separates them:  diff $A $C
MSG
  exit 1
fi

# Neither edited but still divergent (an older commit split them): AGENTS.md is canonical.
if [ "$changed_c" -eq 1 ]; then
  adopt "$C" "$A"
else
  adopt "$A" "$C"
fi
