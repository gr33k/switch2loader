# Switch 2 setup wizard

A portable web guide and small Node.js LAN companion for the pinned [ns2jb](https://gitlab.com/pepsipu/ns2jb) **FS demonstration**. The companion reports actual upstream host output. It does not install EmuHub, launch homebrew, or claim that a console is jailbroken.

## What you need

- A Switch 2 on system **23.0.1**, SmileBASIC **4.4.9**, and more than 20 MiB of free SmileBASIC save space, as required by the pinned upstream procedure.
- A Mac, Linux computer, or NAS reachable from the console on the same LAN, with Node.js 22 or newer and Git.
- Upstream `bootstrap.bas` saved as `NS2` in SmileBASIC program slot 0. The upstream project does not publish a SmileBASIC download key. A USB HID keyboard sender may automate this **one-time** transfer; a browser USB cable by itself cannot do it.

### Choosing the one-time transfer

There is currently no verified, hardware-free, automatic import for `bootstrap.bas`. A public website or LAN server cannot send the first program into an unmodified SmileBASIC editor.

| Path | What it takes | Current status |
| --- | --- | --- |
| USB HID-capable microcontroller | A small board connected to the Switch 2 that acts as a keyboard; no Mac boot-security change | Plausible safer automation path; a Switch 2 sender still needs physical verification |
| Regular USB keyboard | Manually enter and check the upstream program | No extra driver, but around 229 lines of typing |
| `mac2jb` on Apple silicon | Experimental unsigned USB gadget driver; personal testing requires SIP disabled and Permissive Security in Recovery | Physically reported on one Mac model; not recommended as the default end-user path |

If you have only a Mac, a USB cable, and the console, stop at the bootstrap step until you obtain a verified transfer method. The LAN companion becomes useful **after** `NS2` is saved.

## Fast path

On the LAN computer:

```sh
git clone https://github.com/gr33k/switch2loader.git
cd switch2loader
sh scripts/fetch-upstream.sh
SWITCH2_WIZARD_BIND=192.168.1.10 node server.mjs
```

Replace `192.168.1.10` with an IPv4 address assigned to that computer and reachable by the Switch 2. Open `http://192.168.1.10:39381/` in a browser on the same LAN. The companion binds only to `127.0.0.1` unless `SWITCH2_WIZARD_BIND` is set. Port `39381` is the wizard; upstream uses `39380` for its console protocol. Keep both reachable from the console where applicable. Do not publish the companion API to the internet; the public site is a static guide.

The website accepts the console's LAN IP and can ping it **from the companion computer**. This confirms reachability only. Neither the website nor ns2jb can automatically read the console's system or SmileBASIC version before the bootstrap runs.

## One-time bootstrap transfer

Download the pinned upstream [bootstrap.bas](https://gitlab.com/pepsipu/ns2jb/-/blob/95f5525089273c5fce0b95047f3600f8442e96ae/bootstrap.bas), transfer it into SmileBASIC slot 0, then save it as `NS2`. To check a regular USB keyboard first, connect it through a USB-C hub on the console, type `PRINT "USB OK"` in SmileBASIC Direct mode, and press Enter. A regular keyboard still requires manual entry of about 229 lines. This repository does not invent a download key or silently type the file through a website. [mac2jb](https://github.com/cpypwn/mac2jb) is an experimental Apple silicon USB gadget sender. Its personal-use unsigned kernel extension requires disabling SIP and using Permissive Security in Recovery under [Apple's current guidance](https://developer.apple.com/forums/thread/837391); its reported physical test used a different Mac model. Leave a daily-use Mac's security unchanged unless you deliberately accept those changes.

## Run the FS demo

1. Restart the console, open SmileBASIC, and enter Direct mode.
2. Start the upstream host through the **LAN wizard** and select the actual host IP.
3. On the console enter `LOAD "TXT:NS2"`, press Enter, enter `RUN`, press Enter, then enter `REMOVE NSR,&H60000000,&H3FFFFFFF` and press Enter.
4. The expected `Out of memory` message should appear. Enter the fresh `V=START(...)` line displayed by that session's host. Never reuse an old line.
5. Watch the event log. Only the upstream host's explicit `FS execution verified` message counts as a pass. Restart the console when done.

Do not use this on a different version and do not assume it supports EmuHub gameplay. The full game may retain the saved `NS2` program; the demo version may not.

## Self hosting

`public/` is static and can be hosted from any ordinary web server. The public page links to a LAN companion address entered by each visitor and saved only in their browser. `server.mjs` serves the same page plus the local host API. No site-specific domain, IP, SSH key, token, or console data is stored in this repository. Review [TEST_STATUS.md](TEST_STATUS.md) for current evidence.

To update a source checkout: `git pull --ff-only origin main`, run `npm test`, and restart only the companion service if one is installed. A web server pointing at the checkout's `public/` directory sees static updates immediately. The fetched `upstream/ns2jb` directory is ignored and preserved through Git pulls.

The UI reserves future choices for a general homebrew loader and EmuHub install. They are explicitly unavailable until there is a compatible published payload and a physically verified Switch 2 client package.

## Scope and attribution

This project is a guide and wrapper. The upstream exploit code is fetched from `pepsipu/ns2jb` at the pinned revision `95f5525089273c5fce0b95047f3600f8442e96ae`; it is not copied into this repo. Check upstream authorship and license before redistributing it. This wrapper is MIT licensed.
