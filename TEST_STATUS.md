# Test status

Updated 2026-10-23. These are wrapper-project gates. A live deployment should keep its hostnames, device addresses, firewall rules, and rollback details in its own operations notes.

| Gate | Status | Evidence |
| --- | --- | --- |
| Local source syntax and wrapper tests | PASS | `node --check` on `server.mjs` and `public/app.js`; two scoped wrapper tests passed. Use `npm test`, which excludes fetched upstream internals. |
| Upstream pinned host | PASS on a Linux host | `ns2jb` revision `95f5525089273c5fce0b95047f3600f8442e96ae`; upstream `node test.cjs` passed 11/11. SHA256 manifest passed runtime files; README hash differed. |
| Console LAN reachability | PASS for ping only | A local host reached a console address by ICMP. This does not identify the console or its software. |
| Website visual and interaction flow | PARTIAL | Chrome rendered the Matrix layout and valid manual version entry advanced to step 2. Full physical start flow remains pending. |
| Public GitHub and static hosting | PASS for availability | This repository is public; a deployed static page returned HTTP 200. Cache behavior depends on the hosting site. |
| LAN companion | PASS for idle/preflight | A systemd service served the state API on a LAN host, reported pinned upstream ready, and performed a console reachability check. No `/api/start` call or physical run was made. |
| Mac USB sender research | PARTIAL | `cpypwn/mac2jb` source check and build passed on an Apple silicon Mac. Its unsigned kernel-extension source compiled, but was not installed or loaded; Mac security settings stayed unchanged. No USB enumeration test. This is not the default end-user route. |
| Separate USB HID board sender | PENDING | Safer automation candidate; no board or physical Switch 2 transfer is available for qualification. |
| `NS2` on physical Switch 2 | PENDING | No published SmileBASIC download key and no qualified transfer on the target console yet. |
| Physical FS demo | PENDING | No upstream `run.cjs` session or console execution yet. |
| EmuHub Switch 2 client | PENDING | No app loader, graphics, audio, input, storage, core, or gameplay qualification. |

## Generic rollback

Stop and disable the local companion service to disable its LAN API. Remove only the firewall rules added for the companion and upstream protocol, and remove the static site route if desired. Preserve ignored `upstream/ns2jb` and generated `runs/` after a failed physical attempt for diagnosis. No Mac security setting was changed or kernel extension installed during this project test.
