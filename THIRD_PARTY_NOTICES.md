# Third-party notices

The original TIZY client is MIT licensed. Third-party components retain their own copyright and licenses. Samsung, XTLS, [Vetro](https://github.com/andrearicci93/vetro) and Apps2Samsung do not endorse this project.

## Xray-core 26.10.31

Unmodified ARMv7 and ARM64 executables are distributed under **MPL-2.0**. License: [LICENSES/Xray-MPL-2.0.txt](LICENSES/Xray-MPL-2.0.txt).

Corresponding upstream source: <https://github.com/XTLS/Xray-core/tree/v26.10.31>. Release: <https://github.com/XTLS/Xray-core/releases/tag/v26.10.31>. Binary and archive checksums: [docs/xray-provenance.json](docs/xray-provenance.json). TIZY does not claim authorship of Xray-core. Source for covered files is available at the pinned upstream source link; no Xray source modifications are claimed.

## JavaScript dependencies

Pinned versions and integrity records are in `deps/package-lock.json`. Complete installed license texts are preserved under [LICENSES/npm](LICENSES/npm). libsodium ISC notices are also in `app/licenses/`; the QR generator's header notice is retained during the build.

| Package | Version | License |
|---|---|---|
| @leichtgewicht/ip-codec | 2.0.5 | MIT |
| bonjour-service | 1.3.0 | MIT |
| dns-packet | 5.6.1 | MIT |
| fast-deep-equal | 3.1.3 | MIT |
| ipaddr.js | 2.2.0 | MIT |
| libsodium-sumo | 0.7.13 | ISC |
| libsodium-wrappers-sumo | 0.7.13 | ISC |
| multicast-dns | 7.2.5 | MIT |
| qrcode-generator | 1.4.4 | MIT |
| thunky | 1.1.0 | MIT |
| ws | 8.22.1 | MIT |

## Vetro Shard components

The standalone plugin uses its own pinned runtime dependencies: ipaddr.js 1.9.1 (MIT), ws 5.2.4 (MIT), async-limiter 1.0.1 (MIT), libsodium-sumo and libsodium-wrappers-sumo 0.7.9 (ISC), and qrcode-generator 1.4.4 (MIT). Their notices, the TIZY MIT license and the Xray MPL-2.0 license are retained in [plugins/tizy/LICENSE-TIZY.txt](plugins/tizy/LICENSE-TIZY.txt). Build dependency integrity records are in [scripts/plugin-deps/package-lock.json](scripts/plugin-deps/package-lock.json).

The packaging tool and validator under `scripts/plugin-tools/` come from [Vetro release-0.5.0](https://github.com/andrearicci93/vetro/tree/release-0.5.0/app) and retain [Vetro's MIT license](scripts/plugin-tools/LICENSE). These development tools are separate from the plugin runtime.

## Fonts

- **Montserrat**, Copyright 2011 The Montserrat Project Authors. SIL OFL 1.1; [license](LICENSES/OFL.txt), [source](https://github.com/JulietaUla/Montserrat).
- **TIZY CJK SC**, a renamed subset of Noto Sans CJK SC Regular. SIL OFL 1.1; [license](LICENSES/OFL-Noto-CJK.txt), [source and original font hash](app/fonts/TIZY-CJK-source.txt), [upstream](https://github.com/notofonts/noto-cjk). The subset is not represented as an unmodified upstream font.

## Flags

SVG flags derive from **flag-icons** by lipis and contributors, distributed under MIT. [Full copyright and license](LICENSES/flag-icons-MIT.txt), [source](https://github.com/lipis/flag-icons). The precise upstream revision used for the existing SVG collection was not recorded; no version claim is made.

## Related projects and services

[Vetro](https://github.com/andrearicci93/vetro) and Apps2Samsung are external prerequisites/tools, not bundled root exploits or signing certificates. Incy, Happ and v2RayTun transfer integrations do not bundle their mobile applications. Country lookup uses ipwho.is; see [PRIVACY.md](docs/PRIVACY.md) for external calls.

## Redistribution

Keep this file and the `LICENSES/` directory with the WGT when redistributing the installation ZIP. Third-party license terms continue to apply; the client's MIT license does not replace them.
