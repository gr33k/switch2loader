#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
target="$root/upstream/ns2jb"
expected=95f5525089273c5fce0b95047f3600f8442e96ae
if [ -e "$target" ]; then
  echo "Existing upstream directory found: $target" >&2
  echo "Move it aside only after reviewing its contents; this script will not overwrite it." >&2
  exit 1
fi
mkdir -p "$root/upstream"
git clone https://gitlab.com/pepsipu/ns2jb.git "$target"
git -C "$target" checkout --detach "$expected"
actual=$(git -C "$target" rev-parse HEAD)
if [ "$actual" != "$expected" ]; then
  echo "Upstream revision mismatch; do not run the host." >&2
  exit 1
fi
echo "Pinned upstream ready at $actual"
echo "Source is ignored by this repository and is not redistributed here."
