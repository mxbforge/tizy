# Contributing

Use Bug report for failures and Compatibility report for a new model/firmware. Remove personal information from logs before posting.

Work in a separate branch and describe the problem, final behavior and validation. Keep service code compatible with Node.js 10 and remote-control navigation. Display names must not replace application IDs. Never embed shared API credentials in portable packages.

Run the checks in [BUILD.md](docs/BUILD.md). Live-TV, root, subscription and external-relay checks must stay separate from local tests. Ordinary interface testing must not change firmware, boot configuration or root mode.

New dependencies/resources need a source, version/hash and license. Use non-personal data in screenshots.
