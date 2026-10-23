# Switch 2 setup wizard

A portable web guide and small Node.js LAN companion for the pinned [ns2jb](https://gitlab.com/pepsipu/ns2jb) **FS demonstration**. The companion reports actual upstream host output. It does not install EmuHub, launch homebrew, or claim that a console is jailbroken.

## What you need

- A Switch 2 on system **23.0.1**, SmileBASIC **4.4.9**, and more than 20 MiB of free SmileBASIC save space, as required by the pinned upstream procedure.
- A Mac, Linux computer, or NAS reachable from the console on the same LAN, with Node.js 22 or newer and Git.
- Upstream `bootstrap.bas` saved as `NS2` in SmileBASIC program slot 0. The upstream project does not publish a SmileBASIC download key. An already-homebrewed original Switch can automate this **one-time** transfer with NXHID; a browser USB cable by itself cannot do it.

### Choosing the one-time transfer

There is currently no verified direct import of `bootstrap.bas` over LAN into an unmodified SmileBASIC editor. The original Switch running NXHID acts as the USB keyboard while the LAN companion sends it the pinned file.

| Path | What it takes | Current status |
| --- | --- | --- |
| Already-homebrewed original Switch + [NXHID](https://github.com/hyln9/nxhid) | Install the official `.nro`, run it in full application mode, connect Switch 1 USB-C to a Switch 2 dock USB-A port with a USB-A-to-USB-C data cable in TV mode, and send from the LAN companion | Maintainer shows Switch 1 connected to Switch 2; package and host tests verified here, exact physical transfer still pending |
| USB HID-capable microcontroller | A small board connected to the Switch 2 that acts as a keyboard; no Mac boot-security change | Plausible safer automation path; a Switch 2 sender still needs physical verification |
| Regular USB keyboard | Manually enter and check the upstream program | No extra driver, but around 229 lines of typing |
| `mac2jb` on Apple silicon | Experimental unsigned USB gadget driver; personal testing requires SIP disabled and Permissive Security in Recovery | Physically reported on one Mac model; not recommended as the default end-user path |

If you have only a Mac, a USB cable, and the Switch 2, stop at the bootstrap step until you obtain a verified transfer method. The LAN companion's NXHID transfer controls require a homebrewed original Switch; its FS demo becomes useful **after** `NS2` is saved.

## Fast path

On the LAN computer:

```sh
git clone https://github.com/gr33k/switch2loader.git
cd switch2loader
sh scripts/fetch-upstream.sh
sh scripts/fetch-nxhid.sh  # only if using an original homebrewed Switch
SWITCH2_WIZARD_BIND=192.168.1.10 node server.mjs
```

Replace `192.168.1.10` with an IPv4 address assigned to that computer and reachable by the Switch 2. Open `http://192.168.1.10:39381/` in a browser on the same LAN. The companion binds only to `127.0.0.1` unless `SWITCH2_WIZARD_BIND` is set. Port `39381` is the wizard; upstream uses `39380` for its console protocol. Keep both reachable from the console where applicable. Do not publish the companion API to the internet; the public site is a static guide.

The website accepts the console's LAN IP and can ping it **from the companion computer**. This confirms reachability only. Neither the website nor ns2jb can automatically read the console's system or SmileBASIC version before the bootstrap runs.

## One-time bootstrap transfer

For the already-homebrewed original Switch, run `sh scripts/fetch-nxhid.sh` on the host. It checks the official [NXHID 0.1.0 release](https://github.com/hyln9/nxhid/releases/tag/0.1.0) archive against its published SHA256 digest and extracts the `.nro` and Python sender into ignored `upstream/nxhid-release`. Start an existing FTP server on the original Switch, such as [ftpd](https://github.com/mtheall/ftpd), and enter its displayed IP and port in the **local** wizard. The FTP button uploads only `nxhid.nro` to `/switch/nxhid/nxhid.nro`, reads it back for verification, and keeps a timestamped backup if a different file was already there. Optional FTP credentials are used for the request only and are not stored. If the original Switch has no FTP server, copy the `.nro` from `upstream/nxhid-release/switch/nxhid/nxhid.nro` to the same SD-card path by your usual method. FTP itself requires an already-running server on that Switch; the website cannot install that first app remotely.

Exit a foreground FTP app, hold **R** while launching a game to open Homebrew Menu in full application mode, and launch NXHID. Put Switch 2 in its dock in TV mode. Connect the original Switch USB-C port to a USB-A port on the Switch 2 dock using a USB-A-to-USB-C **data** cable. This follows [Nintendo's documented keyboard connection](https://support-jp.nintendo.com/app/answers/detail/a_id/35025); a direct console-to-console USB-C connection is not a qualified keyboard path. Wait for **Keyboard ready** on NXHID and note the original Switch LAN IP. On Switch 2, open the **empty** SmileBASIC slot 0 editor. In the local wizard, enter the original Switch IP, send the one-line keyboard test, check it on screen, and erase it. Full bootstrap transfer and execution remain separate safety gates. The sender uses `ENTER,HOME,CTRL+DELETE` at each newline to avoid SmileBASIC auto-indent. A successful send process alone does not prove the console received every line.

If using a regular USB keyboard, use the Switch 2 dock in TV mode, plug the keyboard into a dock USB port, type `PRINT "USB OK"` in SmileBASIC Direct mode, and press Enter. [Nintendo documents docked TV mode for USB keyboards](https://support-jp.nintendo.com/app/answers/detail/a_id/35025); a USB-C hub in handheld/tabletop mode is unverified for this setup. A regular keyboard still requires manual entry of about 229 lines. [mac2jb](https://github.com/cpypwn/mac2jb) is an experimental Apple silicon USB gadget sender. Its personal-use unsigned kernel extension requires disabling SIP and using Permissive Security in Recovery under [Apple's current guidance](https://developer.apple.com/forums/thread/837391); its reported physical test used a different Mac model. Leave a daily-use Mac's security unchanged unless you deliberately accept those changes.

## FS demo safety hold

The FS demo is paused while a [reported Switch 2 brick](https://x.com/KomodoSSBM/status/2113532446847414660) is investigated. The LAN companion rejects every `/api/start` request with HTTP 423, even if the website button is bypassed. Do not run `NS2`, enter the exploit commands, or retry a failed attempt. Preparing NXHID on an original homebrewed Switch remains available, but host tests and a successful keyboard transfer cannot establish that executing the exploit is safe.

The pinned upstream README says to restart the console after any failed run and says its restoration checks cover native instructions and scratch cleanup. The failure report has not been independently tied to a particular command or recovery sequence. There is no verified zero-brick-risk path and no EmuHub client installation path yet. See [TEST_STATUS.md](TEST_STATUS.md) for the evidence boundary.

## Self hosting

`public/` is static and can be hosted from any ordinary web server. The public page links to a LAN companion address entered by each visitor and saved only in their browser. `server.mjs` serves the same page plus the local host API. No site-specific domain, IP, SSH key, token, or console data is stored in this repository. Review [TEST_STATUS.md](TEST_STATUS.md) for current evidence.

To update a source checkout: `git pull --ff-only origin main`, run `npm test`, and restart only the companion service if one is installed. A web server pointing at the checkout's `public/` directory sees static updates immediately. The fetched `upstream/ns2jb` directory is ignored and preserved through Git pulls.

The UI reserves future choices for a general homebrew loader and EmuHub install. They are explicitly unavailable until there is a compatible published payload and a physically verified Switch 2 client package.

## Scope and attribution

This project is a guide and wrapper. The upstream exploit code is fetched from `pepsipu/ns2jb` at the pinned revision `95f5525089273c5fce0b95047f3600f8442e96ae`; it is not copied into this repo. Check upstream authorship and license before redistributing it. This wrapper is MIT licensed.
