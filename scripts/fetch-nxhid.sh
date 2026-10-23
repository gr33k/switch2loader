#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
target="$root/upstream/nxhid-release"
expected=7562e80814e4a7212d69d17baff8c89618135fae536ad6f363f6c48c7f688752
url=https://github.com/hyln9/nxhid/releases/download/0.1.0/nxhid-0.1.0.zip

if [ -e "$target" ]; then
  echo "Existing NXHID release found: $target" >&2
  echo "Review it before replacing; this script will not overwrite it." >&2
  exit 1
fi

mkdir -p "$root/upstream"
stage=$(mktemp -d "$root/upstream/.nxhid.XXXXXXXX")
trap 'rm -rf "$stage"' EXIT HUP INT TERM
curl --fail --location --silent --show-error --max-time 60 "$url" -o "$stage/nxhid-0.1.0.zip"
actual=$(openssl dgst -sha256 "$stage/nxhid-0.1.0.zip" | awk '{print $NF}')
if [ "$actual" != "$expected" ]; then
  echo "NXHID release checksum mismatch; refusing to extract." >&2
  exit 1
fi

mkdir -p "$stage/client" "$stage/switch/nxhid"
unzip -p "$stage/nxhid-0.1.0.zip" client/nxhid.py > "$stage/client/nxhid.py"
unzip -p "$stage/nxhid-0.1.0.zip" switch/nxhid/nxhid.nro > "$stage/switch/nxhid/nxhid.nro"
test -s "$stage/client/nxhid.py"
test -s "$stage/switch/nxhid/nxhid.nro"
mv "$stage" "$target"
trap - EXIT HUP INT TERM
echo "Verified NXHID 0.1.0 ready at $target"
echo "Copy switch/nxhid/nxhid.nro to the same path on the homebrewed Switch SD card."
