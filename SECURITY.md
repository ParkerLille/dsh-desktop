# Security Policy

## Supported versions

Security fixes are currently provided for the latest released version only.

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |
| Older versions | No |

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub's **Report a vulnerability** flow in the repository Security tab to send a private report to the maintainers.

Include the affected version, reproduction steps, impact, and any suggested mitigation. Remove API keys, credentials, private prompts, session contents, and unrelated personal information from the report.

You should receive an initial acknowledgement within seven days. A fix timeline depends on severity and reproducibility. Please allow maintainers time to investigate before public disclosure.

## Security boundaries

Local plugins run without Node.js or Electron APIs, but they execute in the DSH guest page and can interact with its DOM. Treat plugin source as trusted local code. Provider credentials are managed by DeepSeek Harness and must never be committed to this repository.

The configured `DSH_DESKTOP_URL` is a trust boundary. The desktop checks endpoint reachability but does not authenticate the identity of the local service. The desktop shell adds no analytics of its own; bundled DSH components can have separate telemetry and provider behavior governed by upstream configuration.
