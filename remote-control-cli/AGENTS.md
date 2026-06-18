# OmniRoute Remote CLI Agent Contract

本目录是 OmniRoute 平台远程控制 CLI，面向 AI Agent 与自动化脚本。

## 调用规则

- 默认使用 `node remote-control-cli/omniroute-remote.mjs <command>`。
- stdout 只解析 JSON；不要从 stdout 读取人类说明文本，除非运行 `--help`。
- stderr 中的错误也是 JSON envelope，必须读取 `error.hint` 后自动修复可恢复错误。
- 写操作先执行 `--dry-run`，确认请求摘要后再传 `--yes`。
- `shutdown` 是高风险操作，只有用户明确要求关闭 OmniRoute 服务时才能执行，并且必须传 `--yes danger`。

## 认证

优先级：

1. `--token <manage-api-key>`
2. `OMNIROUTE_API_KEY` 或 `OMNIROUTE_REMOTE_TOKEN`
3. `~/.omniroute/remote-cli.json`

管理 API 需要具备 `manage` scope。

## 输出契约

成功：

```json
{ "ok": true, "data": {}, "_meta": {} }
```

失败：

```json
{ "ok": false, "error": { "type": "missing_auth", "message": "...", "hint": "..." } }
```

## 常用恢复

- `missing_auth`：补 token。
- `confirmation_required`：补 `--dry-run` 或在用户授权后补 `--yes`。
- `dangerous_confirmation_required`：仅在用户明确授权关闭服务时补 `--yes danger`。
- `invalid_json`：改用 `--file` 输入 JSON。
- `network_error`：先 `ping`，再检查 `--url`。
