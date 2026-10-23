# Test status

Updated 2026-10-23.

| Gate | Status | Evidence |
| --- | --- | --- |
| Local source syntax and wrapper tests | PASS | `node --check` on `server.mjs` and `public/app.js`; two scoped wrapper tests passed. The initial unscoped `node --test` also discovered upstream internal files and failed two tests due missing generated `connection.json`; `npm test` is scoped to this wrapper. |
| Upstream pinned host | PASS on NAS | `ns2jb` revision `95f5525089273c5fce0b95047f3600f8442e96ae`; upstream `node test.cjs` passed 11/11. SHA256 manifest passed runtime files; README hash differed. |
| Console LAN reachability | PASS | NAS and Mac pinged `192.168.10.25` 2/2 on 2026-10-23. Ping does not identify console or software. |
| Website visual and interaction flow | PENDING | Needs browser inspection after build. |
| Public GitHub and site publication | PENDING | Source and static route to be published. |
| `NS2` on physical Switch 2 | PENDING | No published SmileBASIC download key; USB HID transfer method not yet qualified on this Mac. |
| Physical FS demo | PENDING | No upstream `run.cjs` session or console execution yet. |
| EmuHub Switch 2 client | PENDING | No app loader, graphics, audio, input, storage, core, or gameplay qualification. |

## Rollback

The static site can be removed without touching the original Switch loader. Stop the LAN companion process to disable its API. `upstream/ns2jb` and any generated `runs/` are ignored by this repo; preserve them for diagnosis rather than deleting after a failed physical run. No Mac security setting is changed by this wrapper.
