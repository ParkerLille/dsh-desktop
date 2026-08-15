# Contributing

Thank you for helping improve DeepSeek Harness Desktop.

## Before opening an issue

- Search existing issues first.
- Use the bug report or feature request template.
- Do not post API keys, credentials, private session logs, or proprietary source code.
- For vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Development setup

Requirements are Windows, Node.js 24+, and pnpm 11+.

```powershell
git clone https://github.com/ParkerLille/dsh-desktop.git
cd dsh-desktop
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm dev
```

## Pull requests

1. Keep changes focused and explain the user-visible behavior.
2. Add or update tests for behavioral changes.
3. Run `pnpm test`, `pnpm typecheck`, and `pnpm build`.
4. Do not commit `node_modules`, `release`, generated build output, logs, credentials, or user session data.
5. Update documentation and `CHANGELOG.md` when the change affects users.

Prefer small commits with imperative subjects, for example `Fix packaged code preset dependencies`.

By contributing, you agree that your contributions are licensed under the repository's MIT License and that you will follow the [Code of Conduct](CODE_OF_CONDUCT.md).
