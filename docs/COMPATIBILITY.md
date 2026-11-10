# Compatibility

## Verified scope

| Component | Checked configuration |
|---|---|
| TV | Samsung QE50QN90AAUXRU |
| Firmware | T-NKM2DEUC-2310.0 |
| Architecture | ARMv7 |
| TIZY | 0.14.4: installation, version, installed files and preserved data verified |
| Integration | [Vetro](https://github.com/andrearicci93/vetro) 0.5.0 with connected UID-0 agent |
| Xray-core | 26.10.31 |
| ARM64 | Binary hash and ELF checked; no ARM64 hardware test |

VPN connectivity was verified on this TV in earlier tests. The latest 0.14.4 hardware check confirmed installation and core readiness, but not connectivity to the selected remote server. This is not a claim that a VPN connection works in every network.

## Requirements

The manifest requires Tizen TV 6.0+. The service uses Node.js 10-compatible JavaScript. It also needs a compatible local [Vetro](https://github.com/andrearicci93/vetro) API with UID 0, access to the package's private data, net_cls cgroups, iptables/ip6tables, and permission to run the pinned Xray from a temporary read-only bind mount.

Root and kernel capabilities depend on model and firmware. Check [Vetro compatibility](https://github.com/andrearicci93/vetro#compatibility) separately. TIZY does not make an unsupported firmware compatible.

## What Universal means

One package carries ARMv7 and ARM64 binaries and selects the appropriate core. It searches for [Vetro](https://github.com/andrearicci93/vetro) only on loopback: known ports, local listeners, then the 1–65535 range with bounded concurrency. Service identity and UID-0 readiness are checked separately.

Universal does not mean every Samsung, every root method or every firmware.

## Network scope

Application redirection covers TCP and DNS. Direct IPv6 and UDP/QUIC are restricted by the selected routing policy to prevent bypassing the IPv4 application tunnel. Local-network destinations are excluded from general redirection; DNS is handled separately. This is not a general-purpose system TUN implementation.

IPv4/IPv6 preference controls the connection to the VPN server, not direct IPv6 application traffic inside the tunnel. Shared system packages can serve multiple apps. Restart affected apps after routing changes if needed.

Root is temporary and depends on [Vetro](https://github.com/andrearicci93/vetro). Access can take time after reboot. TIZY does not change the bootloader, firmware or global unsigned-code protection.
