# TIZY 0.14.4 Universal

A remote-friendly VPN client for Samsung Tizen TVs, built around Xray-core and an existing [Vetro](https://github.com/andrearicci93/vetro) UID-0 integration.

## Download and install

Download **TIZY-0.14.4-Universal-install.zip**, extract it, and install the WGT with [Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung/releases). Keep the included license notices. You need your own server or subscription and a working root integration. [Installation guide](https://github.com/mxbforge/tizy/blob/main/docs/INSTALLATION.md).

## Included

- Fresh root-readiness checks after standby and clearer transport-error messages.
- Link/HTTPS subscription import and Incy, Happ and v2RayTun QR transfer.
- Autoconnect, per-app routing and four interface languages.
- ARMv7/ARM64 cores and automatic local service discovery in one package.

## Verified scope and limitations

Installation, version, installed files and preserved data were verified on QE50QN90AAUXRU / T-NKM2DEUC-2310.0 / ARMv7. ARM64 binary hash/format were checked; ARM64 hardware was not tested. Root-loss recovery is covered by integration tests. The latest hardware check did not establish a VPN connection because the selected remote server was unreachable from that TV network; the package does not resolve external routing restrictions.

Application redirection covers TCP and DNS, with direct IPv6 and UDP/QUIC restricted by policy. Compatibility with every Samsung model or firmware is not claimed. No VPN credentials, servers or Samsung signing certificates are included.

## Assets

- `TIZY-0.14.4-Universal-install.zip`: WGT and license notices.
- `TIZY-0.14.4-Universal.sha256`: checksum of the extracted WGT.
- `TIZY-0.14.4-source.zip`: prepared source tree.
- `TIZY-0.14.4-screenshots-en.zip`: interface screenshots, 1920×1080 PNG.
- `SHA256SUMS.txt`: checksums of release assets.

Original client code is MIT licensed; third-party licenses are preserved. Thanks to Xray-core, [Vetro](https://github.com/andrearicci93/vetro), Apps2Samsung and the configuration-transfer projects. TIZY is an independent project.
