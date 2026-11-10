# Build and verify

## Development environment

Use Python 3.10+, Node.js 20+ and npm on your computer. CI uses Node.js 22; this is separate from the TV's Node.js 10+ runtime. Keep service code compatible with the TV.

```sh
npm ci --prefix deps --ignore-scripts
npm ci --ignore-scripts
npm run build
```

Pinned Xray cores are included and checked by SHA256. The builder does not download or run ARM executables on the computer, obtain root or install anything on a TV. Every build is portable: development keys and device data are excluded.

Output is WGT plus SHA256 under `dist/`. It is not signed for a TV. Sign and install separately with Apps2Samsung.

## Tests

```sh
npm run verify:public
npm test
npm run test:ui
npm run test:integration
npm run test:package
```

Integration checks use local mock [Vetro](https://github.com/andrearicci93/vetro) and API services. Run them sequentially with ports 8099, 9000, 19090 and 19100 available. They do not replace hardware testing. Live QR-relay and TV checks are separate from the main suite.

For layout and scrolling, run `npm run test:layout`. It defaults to the standard macOS Google Chrome path; set `CHROME` to your Chrome executable on other systems. It uses a temporary profile.

## Reproducibility

`deps/package-lock.json` pins runtime/build dependencies; root `package-lock.json` pins test tooling. Archive entries use fixed dates and binary permissions. See [Xray provenance](xray-provenance.json). Compare the WGT with the checksum for its release; any content/packaging change requires a new checksum.

Distribute the WGT with the complete license notices in the installation ZIP. The client license does not replace third-party terms.

## Layout

- `app/`: interface, service, resources and cores.
- `deps/`: pinned dependencies.
- `tests/`: unit and integration checks.
- `tools/`: test runner and public-tree audit.
- `docs/`: installation, compatibility, privacy and development.
- `LICENSES/`: third-party notices.
- `dist/`: ignored local build output.

No device-specific management scripts, certificates, preloaded servers or automatic release publication are included.
