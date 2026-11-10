# Install TIZY

## Before you start

Use a trusted local network shared by your TV and installer. Verify your model/firmware against your root integration separately from TIZY. [Vetro](https://github.com/andrearicci93/vetro) must already be installed with its root agent connected as `uid=0`. Bring your own server or subscription.

Follow the [official Vetro installation guide](https://github.com/andrearicci93/vetro/blob/main/app/docs/INSTALLATION.md). Root procedures can affect TV functionality, DRM and warranty servicing. TIZY does not include firmware, a boot modification or a persistent-root installer.

## 1. Download the package

From [Releases](https://github.com/mxbforge/tizy/releases), download `TIZY-0.14.4-Universal-install.zip` and extract it. Keep the license notices with the WGT. GitHub's automatic Source code archives are developer sources, not installable WGT files.

Check the extracted WGT if needed:

```sh
# macOS
shasum -a 256 TIZY-0.14.4-Universal.wgt
# Linux
sha256sum -c TIZY-0.14.4-Universal.sha256
```

## 2. Prepare Apps2Samsung

Get [Apps2Samsung from its official releases](https://github.com/Apps2Samsung/Apps2Samsung/releases).

On the TV open **Apps**, enter **12345** with the remote, enable **Developer Mode**, and temporarily set **Host PC IP** to the address of your installer device. Fully restart the TV. Note the previous address: the autonomous [Vetro](https://github.com/andrearicci93/vetro) integration may depend on it.

Menu names vary by TV and installer version. Allow local-network access if your operating system asks.

## 3. Install the WGT

Select your TV in Apps2Samsung, choose installation of your own `.wgt` file, and select `TIZY-0.14.4-Universal.wgt`. On first use the installer may open Samsung sign-in to prepare a certificate. Use a certificate valid for your TV; the package does not contain someone else's signing credentials.

Command-line alternative after preparing Developer Mode and a certificate:

```sh
apps2samsung-cli install ./TIZY-0.14.4-Universal.wgt --tv TV_IP
```

Replace `TV_IP` with your TV's address. TIZY does not need to be listed in the Apps2Samsung community catalog.

## 4. Restore autonomous Vetro access

Restore the working autonomous SDB setting for your [Vetro](https://github.com/andrearicci93/vetro) installation, fully restart the TV and wait for its root agent. The official guide describes Host PC IP `127.0.0.1`. The tested QN90A installation used the TV's own LAN IP instead; that is a device-specific observation, not a universal replacement for the official step.

Open [Vetro](https://github.com/andrearicci93/vetro) once if its installation requires that step. Confirm that the agent is actually connected. TIZY finds the local port automatically, but does not create root or make it instant.

## 5. Add a server

Open TIZY → **Add**.

- Link: paste a connection link or public HTTPS subscription and confirm the import.
- Incy: follow its Send to TV flow and scan the code.
- Happ: choose **QR code**, scan, and send the profiles.
- v2RayTun: tap the QR-code image in the server menu.

A successful import shows an animated check and adds the profile under Servers. Select it, connect from Home and verify the connection. Optionally enable **Settings → Connection → VPN autoconnect**.

## Upgrade

Use the same certificate for updates. Ordinary package updates preserve data. If author signatures differ, the installer may offer to remove the old package; removal clears profiles and settings. Keep your original links/subscriptions in your own client before removing anything. Exported logs are not a profile backup.

## Uninstall

Disconnect the VPN in TIZY first, then remove the app through the TV or installer. Package data is deleted. If normal networking does not return, fully restart the TV. See [Troubleshooting](TROUBLESHOOTING.md).
