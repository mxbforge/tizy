# TIZY Shard 0.4.3

A standalone Xray VPN plugin for [Vetro](https://github.com/andrearicci93/vetro) 0.5.0, using the experimental Shards API 1. Manage it in **Vetro → Shards → TIZY** from your browser. The TIZY TV app, its background service and a continuously running computer are not required. Vetro and its root-agent must remain running on the TV.

[Download tizy-0.4.3.vplugin](https://github.com/mxbforge/tizy/releases/download/shard-v0.4.3/tizy-0.4.3.vplugin) · [Release and checksums](https://github.com/mxbforge/tizy/releases/tag/shard-v0.4.3) · [Русский](../../docs/SHARD.ru.md)

## Installation

1. Set up a compatible [Vetro](https://github.com/andrearicci93/vetro) 0.5.0 installation with a working UID-0 root-agent.
2. Download `tizy-0.4.3.vplugin` from the release above.
3. Open **Vetro → Shards → Install from a file**, enable the Shards Developer mode when prompted, and select the file. This is the plugin setting inside Vetro.
4. Enable TIZY, open its tab, and add a server through **+ Add** using a link, an HTTPS subscription or a supported QR transfer.
5. Disconnect any other VPN on the TV, select your server, and press the power button on Home. Xray is downloaded and verified on the first connection.

You can close the browser after connecting. Autoconnect runs when Vetro starts the enabled plugin and its root-agent becomes available. This plugin does not provide persistent root or change TV firmware or the bootloader. It is a file-installed plugin; it is not listed in Vetro's official catalog.

The project GitHub link is in **Settings → About**. Vetro restricts external navigation inside plugin tabs, so selecting it opens a copyable address for your browser.

## Features

- VLESS / Reality / XHTTP, VMess, Trojan and Shadowsocks; link and HTTPS subscription import, up to 200 servers.
- QR transfer from Incy, Happ and v2RayTun, with cancellation and an animated success confirmation.
- Per-application VPN routing and direct-access exclusions.
- TCP connection timing, Xray traffic counters, connection duration and reconnect after a failed tunnel check.
- Autoconnect with up to three attempts; manual disconnect pauses it until a manual connection, a setting change or a plugin restart.
- Russian, English, Turkish and Simplified Chinese; automatic language selection.
- Optional in-memory logs, filtering, clearing and redacted TXT export. Logging defaults off.
- Import from an existing TIZY TV installation when the plugin server list is empty. The original data is preserved. Disconnect the old client before connecting the plugin.

## Compatibility and network scope

Hardware testing has covered **Samsung QE50QN90AAUXRU / Tizen 6 / ARMv7 / Node 12.4.0**. ARM64 and other TV models need separate hardware testing. JavaScript is ES5 compatible; offline contract and compatibility tests cover plugin lifecycle, routing commands, settings, QR cancellation and UI behavior.

Application routing redirects **IPv4 TCP** and sends DNS through the VPN. External UDP and direct IPv6 are blocked by the routing policy; the home network stays direct. This is not a general UDP/IPv6 tunnel or a TUN implementation. IPv4 and IPv6 addresses can be used for the VPN server itself. HTTPS subscriptions are fetched over IPv4. Concurrent VPN clients are not supported.

Disabling the plugin removes its own routing rules. A lease watchdog cleans up after a service crash, normally within 20 seconds. This is recovery behavior, not a guarantee that an application can never send direct traffic during every startup or failure condition.

Vetro plugins run with the service's access, including root. Install only code you trust. See the [Vetro plugin documentation](https://github.com/andrearicci93/vetro/blob/release-0.5.0/app/docs/plugins.md).

## Runtime, data and external services

The `.vplugin` contains text only and fits API 1's 20-file / 512 KB limit. Unmodified Xray 26.10.31 is downloaded from the existing `mxbforge/tizy` source commit `76d1b94b2495f5e475e20086102677e3e59ebdde` and verified before execution:

| Architecture | SHA-256 |
|---|---|
| ARMv7 | `2a893d5b5f7cf5a33168c102f01771ed69a674abeab0b8fb085b1ddf098cf52c` |
| ARM64 | `5939649960deaf535bcd5f7ce0467a2b1d63b72a2758a6f42eade714ae8d5328` |

Servers and settings are stored in the plugin's private `config.json` (0600). Vetro preserves it across updates; removing the plugin deletes it. Runtime files are stored in `/opt/usr/home/owner/share/tizy-shard-data`. Xray uses a temporary read-only bind mount under `/opt/usr/home/owner/share/tizyp-runtime-uep/ro`. Routing uses separate `TIZYP_*` chains and cgroups. Local service ports are 20053, 20080–20082 and 20085.

QR reception downloads pinned libsodium 0.7.9 libraries from jsDelivr on first use, verifies SHA-256 and caches them on the TV. Incy and v2RayTun use their external relay services; Happ transfers over the local network. No server or subscription is included with TIZY.

Vetro 0.5.0's plugin frame blocks automatic file downloads. Log export therefore displays a URL to copy into your browser's address bar. That URL contains a plugin session token: keep it private. It expires after eight hours or when the plugin is disabled.

## Build and checks

Run from the repository root with Node.js 20+ and npm:

```sh
npm ci --ignore-scripts
npm ci --prefix deps --ignore-scripts
npm ci --prefix scripts/plugin-deps --ignore-scripts
npm run build:plugin
npm run test:plugin
```

The output is `dist/tizy-0.4.3.vplugin`. Packaging and validation tools are copied from [Vetro release-0.5.0](https://github.com/andrearicci93/vetro/tree/release-0.5.0/app) and retain their MIT license. The manifest, source and lockfiles are included in this repository.

## Licenses

Original TIZY code is MIT licensed; Xray is MPL-2.0. The combined `LICENSE-TIZY.txt` inside the plugin retains the notices for Xray, ipaddr.js 1.9.1, ws 5.2.4, async-limiter 1.0.1, libsodium 0.7.9 and qrcode-generator 1.4.4. See also [third-party notices](../../THIRD_PARTY_NOTICES.md).
