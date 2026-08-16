# Changelog

All notable changes to this project will be documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Removed

- Removed the local plugin workbench and its desktop chrome. The desktop shell now shows the full DSH web GUI with no overlay UI.

## [0.1.0] - 2026-08-15

### Added

- Electron desktop shell for the complete DeepSeek Harness web application.
- Managed bundled or external DSH web process startup.
- Sandboxed local browser-plugin workbench with panels, styles, commands, and notifications.
- Context-isolated IPC bridge and restricted guest navigation.
- Windows NSIS packaging with pinned, checksum-verified build tools.
- Packaging checks for DSH code-mode runtime dependencies.
- Guarded recovery command for interrupted-session replay sequence corruption.
- Automated tests for process management, plugins, renderer behavior, packaging, and session recovery.

[Unreleased]: https://github.com/ParkerLille/dsh-desktop/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ParkerLille/dsh-desktop/releases/tag/v0.1.0
