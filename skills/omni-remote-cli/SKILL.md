---
name: omni-remote-cli
description: "Use the project-local OmniRoute Remote CLI to control a running OmniRoute platform over HTTP. Use when the user asks to remotely control OmniRoute, inspect or manage providers/models/combos/settings/cache/version-manager/shutdown via the generated remote-control-cli, configure ~/.omniroute/remote-cli.json, or needs AI-friendly CLI invocation with JSON envelopes, dry-run, --yes safeguards, and actionable error hints."
---

# OmniRoute Remote CLI

Use the bundled remote-control CLI script at `skills/omni-remote-cli/scripts/omniroute-remote.mjs` to control a running OmniRoute platform from scripts or agents. If this skill has been copied outside the repository, resolve the script path relative to this `SKILL.md` file.

## Contract

- Parse stdout as JSON only: success is `{"ok":true,"data":...}`.
- Parse stderr as JSON error envelope: failure is `{"ok":false,"error":{"type","message","hint"}}`.
- Read `error.hint` and retry automatically when the fix is safe.
- Require `--dry-run` before risky edits unless the user already explicitly asked to execute.
- Require `--yes` for write operations.
- Require `--yes danger` only when the user explicitly asked to shut down OmniRoute.
- Never expose the raw token in final answers, logs, or screenshots.

## Command Path

Run from the repository root:

```bash
node skills/omni-remote-cli/scripts/omniroute-remote.mjs <command> [args] [--flags]
```

Fallback when working in this repository and the bundled script is unavailable:

```bash
node remote-control-cli/omniroute-remote.mjs <command> [args] [--flags]
```

For human-readable JSON during investigation, add `--output pretty`.

## Configuration

Config priority is: flags > env > `~/.omniroute/remote-cli.json` > defaults.

Supported config file:

```json
{
  "url": "http://127.0.0.1:20128",
  "token": "your-manage-api-key",
  "timeoutMs": 30000
}
```

Initialize or update config:

```bash
node skills/omni-remote-cli/scripts/omniroute-remote.mjs config:init \
  --url http://127.0.0.1:20128 \
  --token '<manage-api-key>'

node skills/omni-remote-cli/scripts/omniroute-remote.mjs config:set url http://127.0.0.1:20128
node skills/omni-remote-cli/scripts/omniroute-remote.mjs config:set token '<manage-api-key>'
node skills/omni-remote-cli/scripts/omniroute-remote.mjs config:show --output pretty
```

Prefer env vars for one-off automation:

```bash
OMNIROUTE_REMOTE_URL=http://127.0.0.1:20128 \
OMNIROUTE_API_KEY='<manage-api-key>' \
node skills/omni-remote-cli/scripts/omniroute-remote.mjs providers:list
```

## Discovery

Use these before assuming a command shape:

```bash
node skills/omni-remote-cli/scripts/omniroute-remote.mjs commands --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs schema --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs --help
```

## Common Operations

Health and reachability:

```bash
node skills/omni-remote-cli/scripts/omniroute-remote.mjs ping --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs raw GET /api/health/ping --output pretty
```

Providers, models, and combos:

```bash
node skills/omni-remote-cli/scripts/omniroute-remote.mjs providers:list --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs providers:get <providerConnectionId> --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs providers:test <providerConnectionId> --dry-run --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs providers:test <providerConnectionId> --yes --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs models:list --query all=true --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs combos:list --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs combos:get <comboId> --output pretty
```

Safe combo edits:

```bash
node skills/omni-remote-cli/scripts/omniroute-remote.mjs combos:create --file combo.json --dry-run --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs combos:create --file combo.json --yes --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs combos:update <comboId> --file combo.patch.json --dry-run --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs combos:update <comboId> --file combo.patch.json --yes --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs combos:delete <comboId> --dry-run --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs combos:delete <comboId> --yes --output pretty
```

Settings, cache, usage, and version manager:

```bash
node skills/omni-remote-cli/scripts/omniroute-remote.mjs settings:get --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs settings:patch --data '{"requireLogin":true}' --dry-run --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs cache:stats --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs cache:clear --dry-run --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs cache:clear --yes --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs usage:quota --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs version:status --output pretty
```

Raw API calls:

```bash
node skills/omni-remote-cli/scripts/omniroute-remote.mjs raw GET /api/provider-metrics --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs raw PATCH /api/settings --data '{"requireLogin":true}' --dry-run --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs raw PATCH /api/settings --data '{"requireLogin":true}' --yes --output pretty
```

Shutdown guardrail:

```bash
node skills/omni-remote-cli/scripts/omniroute-remote.mjs shutdown --dry-run --output pretty
node skills/omni-remote-cli/scripts/omniroute-remote.mjs shutdown --yes danger --output pretty
```

Only run the second command when the user explicitly requested stopping the running OmniRoute process.

## Error Recovery

- `missing_auth`: provide `--token`, `OMNIROUTE_API_KEY`, or configure `~/.omniroute/remote-cli.json`.
- `confirmation_required`: retry with `--dry-run`; use `--yes` only if execution is authorized.
- `dangerous_confirmation_required`: do not retry unless the user explicitly authorized shutdown; then use `--yes danger`.
- `missing_body`: provide `--data`, `--file`, or `--stdin`.
- `invalid_json`: move JSON into a file and retry with `--file`.
- `timeout`: increase `--timeout` or run `ping` first.
- `network_error`: verify `--url`, tunnel reachability, and whether OmniRoute is running.
- `unauthorized` or `forbidden`: verify the API key has `manage` scope.
