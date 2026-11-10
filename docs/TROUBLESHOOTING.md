# Troubleshooting

## Waiting for root access

Check the root agent in [Vetro](https://github.com/andrearicci93/vetro), not only whether its dashboard loads. Startup can take time. Restore autonomous Host PC IP according to its installation guide; an installer's temporary connection can interfere. Since 0.14.4, losing root invalidates cached core readiness and autoconnect waits for a fresh successful check.

## Core ready, but no VPN connection

Core readiness means Xray can run. It does not validate server reachability, credentials, DNS or the external connectivity-check URL.

Try the same server on another device, then compare the devices' network paths. Even on one Wi-Fi network, a router can route a computer through a VPN and the TV directly. A working phone connection does not establish TV reachability. Check router routing or explicitly choose another server you control.

## curl (28) or timeout

Older builds could display the raw transport error. Version 0.14.4 shows a server-reachability explanation, retaining the exact error in event details when logging is enabled. A timeout does not by itself identify a root failure. Waiting longer cannot repair an address that does not answer TCP requests.

## Why connection attempts continue

Automatic startup and recovery retry with backoff. A manual start is limited to three attempts; exhaustion needs another manual start. Manual disconnect pauses automatic connection for the current boot. The saved autoconnect preference remains.

## QR import fails

Check the selected format, code expiry, internet and local-network access. Happ uses QR code; v2RayTun uses the QR-code image in the server menu. Incy and v2RayTun depend on external transfer services. Happ devices must be able to reach each other on the local network.

## Two browser entries

Samsung Browser and Samsung Knox Browser may be separate packages. They retain separate IDs and routing selections. Shared application packages are marked separately.

## Author certificate mismatch

Use the previous certificate. Removing and reinstalling clears package data. Preserve your original configurations first. Never attach certificates, passwords, keys or complete connection links to a public issue.

## Useful bug-report information

Include TIZY version, TV model, firmware, architecture, root-agent state, reproduction steps and a reviewed/redacted log excerpt. Do not include serial numbers, DUIDs, MAC addresses, home addresses, UUIDs, subscriptions or keys. Automatic log redaction does not replace your own review.
