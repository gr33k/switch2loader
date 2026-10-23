#!/usr/bin/env python3
"""Install the pinned NXHID NRO into a Switch SD card exposed by FTP."""

import hashlib
import io
import json
from ftplib import FTP, error_perm, error_temp
from pathlib import Path
import sys
from datetime import datetime, timezone


ROOT = Path(__file__).resolve().parent.parent
NRO = ROOT / "upstream/nxhid-release/switch/nxhid/nxhid.nro"
EXPECTED = "88e016a11c296760cfdee9624f7fcd63dc20b21b9dc3d9b923d64fa6152605a3"


def remote_bytes(ftp, name):
    chunks = []
    try:
        ftp.retrbinary(f"RETR {name}", chunks.append)
    except (error_perm, error_temp) as exc:
        # Some Switch FTP servers report a missing file as 450 rather than 550.
        if str(exc).startswith(("550", "450 No such file or directory")):
            return None
        raise
    return b"".join(chunks)


def enter_switch_folder(ftp):
    for folder in ("/switch", "/sdmc:/switch", "sdmc:/switch"):
        try:
            ftp.cwd(folder)
            return
        except (error_perm, error_temp):
            pass
    raise RuntimeError("FTP did not show the Switch SD card's /switch folder. Check the FTP app and SD access.")


def install(ftp, payload):
    enter_switch_folder(ftp)
    try:
        ftp.cwd("nxhid")
    except error_perm:
        ftp.mkd("nxhid")
        ftp.cwd("nxhid")

    current = remote_bytes(ftp, "nxhid.nro")
    if current == payload:
        return {"status": "already_installed", "path": "/switch/nxhid/nxhid.nro", "sha256": EXPECTED}

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    temp = f"nxhid.nro.upload-{stamp}"
    backup = f"nxhid.nro.backup-{stamp}" if current is not None else None
    try:
        ftp.storbinary(f"STOR {temp}", io.BytesIO(payload))
        received = remote_bytes(ftp, temp)
        if received != payload:
            raise RuntimeError("FTP read-back differed from the verified NXHID file; original file was left in place.")
        if backup:
            ftp.rename("nxhid.nro", backup)
        try:
            ftp.rename(temp, "nxhid.nro")
        except Exception:
            if backup:
                ftp.rename(backup, "nxhid.nro")
            raise
    finally:
        try:
            ftp.delete(temp)
        except (error_perm, error_temp):
            pass
    return {"status": "installed", "path": "/switch/nxhid/nxhid.nro", "sha256": EXPECTED, "backup": backup}


def main():
    options = json.load(sys.stdin)
    payload = NRO.read_bytes()
    if hashlib.sha256(payload).hexdigest() != EXPECTED:
        raise RuntimeError("NXHID NRO hash mismatch; upload refused.")
    with FTP() as ftp:
        ftp.connect(options["switchIp"], options["port"], timeout=8)
        ftp.login(options["username"] or "anonymous", options["password"])
        ftp.set_pasv(True)
        result = install(ftp, payload)
    print(json.dumps(result))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"status": "failed", "error": str(exc)}))
        sys.exit(1)
