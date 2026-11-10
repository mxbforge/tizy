# Release maintenance

The public repository is intended to be `mxbforge/tizy`, with English as the default README and a separate [Russian translation](../README.ru.md).

Before a release, run the public-tree audit, build and relevant tests. Check that the WGT has no installation credentials, include all license notices in the installation ZIP, update source and asset checksums, and review the release text in [RELEASE-NOTES.md](../RELEASE-NOTES.md).

Use Git or GitHub Desktop for source uploads: the bundled Xray files exceed the browser's 25 MiB file limit. Each file is below the ordinary 100 MiB Git limit.

The verification workflow builds/tests and stores an artifact. It does not create a release or install anything on a TV. Publish a version only after checking the actual results. Use pre-release status while compatibility remains experimental.
