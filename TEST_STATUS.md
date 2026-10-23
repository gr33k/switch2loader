# Test status

Updated 2026-10-23.

| Gate | Status | Evidence |
| --- | --- | --- |
| Local source syntax and wrapper tests | PASS | `node --check` on `server.mjs` and `public/app.js`; two scoped wrapper tests passed. The initial unscoped `node --test` also discovered upstream internal files and failed two tests due missing generated `connection.json`; `npm test` is scoped to this wrapper. |
| Upstream pinned host | PASS on NAS | `ns2jb` revision `95f5525089273c5fce0b95047f3600f8442e96ae`; upstream `node test.cjs` passed 11/11. SHA256 manifest passed runtime files; README hash differed. |
| Console LAN reachability | PASS | NAS and Mac pinged `192.168.10.25` 2/2 on 2026-10-23. Ping does not identify console or software. |
| Website visual and interaction flow | PARTIAL | Chrome rendered the Matrix layout and a valid manual version entry advanced to step 2. Full physical start flow remains pending. |
| Public GitHub and static site | PARTIAL | `gr33k/switch2loader` public repo; `https://thec0de.com/switch2loader/` returned HTTP 200 after deployment. WordPress menu order was verified on a cache-bypassed homepage: Switch Loader 7, Switch 2 Loader 8, PrivateBin 9. The ordinary homepage still served stale cached HTML and needs cache invalidation. |
| NAS LAN companion | PASS for idle/preflight | systemd `switch2loader.service` active on `192.168.10.144:39381`; API reports pinned upstream ready; Mac reached it; NAS reachability check for `192.168.10.25` returned true. Firewalld allows TCP 39380 and 39381 only from `192.168.10.0/24`. No `/api/start` called. |
| Mac USB sender preflight | PARTIAL | `cpypwn/mac2jb` at `dc2e4c745d4419bc3d42d4e4e51cb32e3b9a396c` cloned separately; `bash scripts/check.sh` and `make -j2` passed, bundled bootstrap checksum passed. `MacBookPro17,1` on macOS 26.6.2 has SIP enabled and no `usbgadget.kext` loaded. Physical HID enumeration untested. |
| `NS2` on physical Switch 2 | PENDING | No published SmileBASIC download key; USB HID transfer method not yet qualified on this Mac. |
| Physical FS demo | PENDING | No upstream `run.cjs` session or console execution yet. |
| EmuHub Switch 2 client | PENDING | No app loader, graphics, audio, input, storage, core, or gameplay qualification. |

## Rollback

The static site can be removed without touching the original Switch loader. Stop and disable `switch2loader.service` to disable its LAN API. The two FedoraServer rich rules for TCP 39380 and 39381 from `192.168.10.0/24` can be removed with matching `firewall-cmd --remove-rich-rule` calls in runtime and permanent configuration. `upstream/ns2jb` and any generated `runs/` are ignored by this repo; preserve them for diagnosis rather than deleting after a failed physical run. No Mac security setting was changed or kext installed.
