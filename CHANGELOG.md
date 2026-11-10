# Changelog

## 0.14.4

- Invalidate cached core readiness when root is lost after standby; autoconnect waits for a fresh successful probe.
- Explain transport timeouts while retaining the redacted diagnostic in log details when logging is enabled.
- Add regression coverage for root loss, standby and automatic recovery.

## 0.14.3

- Match language/server tile press feedback to the VPN autoconnect surface flash.
- Remove oversized circular feedback that could render as vertical stripes on TV.

## 0.14.2

- Update Happ and v2RayTun QR-transfer instructions in four languages.

## 0.14.1

- Clear system-application labels without changing package IDs.
- Improved root-wait message and five-second visibility for the exhausted manual-attempt notice.
- Logging off on a clean install, with existing preferences preserved on upgrade.

## 0.14.0

- Universal loopback [Vetro](https://github.com/andrearicci93/vetro) discovery with UID-0 validation.
- ARMv7/ARM64 cores and fallback service ports in one package.
- Per-install local API key.
