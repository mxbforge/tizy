# Data and external connections

## Stored on the TV

TIZY stores imported profiles, preferences and an individual API key in its package data. The key is generated on first install; the portable WGT contains no shared user key. TIZY's API listens on loopback. Protection of the [Vetro](https://github.com/andrearicci93/vetro) LAN dashboard is a separate responsibility of that integration and your network.

Logging defaults off on a clean installation; upgrades preserve the previous preference. Known keys and links are redacted, but review a log before sharing it. Temporary log export opens a time-limited link on the local network.

## External requests

| Action | Destination and purpose |
|---|---|
| VPN connection | Your server, then traffic according to routing policy |
| Tunnel check | `www.gstatic.com/generate_204`, expecting HTTP 204 |
| Country flags | `ipwho.is`: public VPN-server IP; the result is cached |
| Subscription import | Your supplied public HTTPS site; configuration is downloaded to the TV |
| Incy QR | `check.incytv.com`: transfer registration and retrieval through a relay |
| v2RayTun QR | `vault.v2raytunpulse.com`: WebSocket transfer service |
| Happ/local transfer | Temporary local-network receiver; may use local discovery |

Use transfer services and subscriptions you trust. TIZY does not control third-party policies or promise identical encryption for every import method.

The client source contains no separate product-analytics collector. This does not mean it makes no external requests: the listed features, Xray and TV applications use the network. External services can see the device/exit IP and request data according to their implementation.

## Public reports

Do not publish `profiles.json`, `local-key.json`, `auth.header`, `tizy-endpoint.json`, Samsung certificates or connection links containing credentials. Issue templates do not request these files. Serial number, DUID, MAC and home-network addresses are unnecessary for public reports.
