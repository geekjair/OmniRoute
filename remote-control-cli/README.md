# OmniRoute Remote CLI

这是按《AI 友好 CLI 构建完全指南》生成的 OmniRoute 平台远程控制 CLI，独立放在 `remote-control-cli/`，不侵入现有 `bin/cli`。

## CLI Contract

- stdout：只输出机器可解析数据，默认 JSON envelope。
- stderr：只输出诊断和结构化错误 envelope。
- 成功：`{"ok":true,"data":...,"_meta":...}`。
- 失败：`{"ok":false,"error":{"type","message","hint"}}`。
- 写操作：必须传 `--yes`；高风险 `shutdown` 必须传 `--yes danger`。
- 预览：所有写操作支持 `--dry-run`，不会请求服务端。
- 配置优先级：flags > env > `~/.omniroute/remote-cli.json` > defaults。

## 安装/运行

```bash
node remote-control-cli/omniroute-remote.mjs --help
node remote-control-cli/omniroute-remote.mjs commands --output pretty
```

可选创建软链：

```bash
ln -s "$PWD/remote-control-cli/omniroute-remote.mjs" /usr/local/bin/omniroute-remote
```

## 配置认证

管理 API 需要具备 `manage` scope 的 OmniRoute API key。

```bash
node remote-control-cli/omniroute-remote.mjs config:init \
  --url http://127.0.0.1:20128 \
  --token '<manage-api-key>'

node remote-control-cli/omniroute-remote.mjs config:show --output pretty
```

也可以不落盘，直接使用环境变量：

```bash
OMNIROUTE_REMOTE_URL=http://127.0.0.1:20128 \
OMNIROUTE_API_KEY='<manage-api-key>' \
node remote-control-cli/omniroute-remote.mjs providers:list
```

## 常用远控命令

```bash
# 存活检查：无需认证
node remote-control-cli/omniroute-remote.mjs ping --output pretty

# Provider / Model / Combo
node remote-control-cli/omniroute-remote.mjs providers:list --output pretty
node remote-control-cli/omniroute-remote.mjs providers:get <providerConnectionId> --output pretty
node remote-control-cli/omniroute-remote.mjs providers:test <providerConnectionId> --yes --output pretty
node remote-control-cli/omniroute-remote.mjs models:list --query all=true --output pretty
node remote-control-cli/omniroute-remote.mjs combos:list --output pretty
node remote-control-cli/omniroute-remote.mjs combos:get <comboId> --output pretty

# 写操作先 dry-run
node remote-control-cli/omniroute-remote.mjs combos:update <comboId> --file combo.patch.json --dry-run --output pretty
node remote-control-cli/omniroute-remote.mjs combos:update <comboId> --file combo.patch.json --yes --output pretty

# 设置、缓存、运行状态
node remote-control-cli/omniroute-remote.mjs settings:get --output pretty
node remote-control-cli/omniroute-remote.mjs cache:stats --output pretty
node remote-control-cli/omniroute-remote.mjs cache:clear --dry-run --output pretty
node remote-control-cli/omniroute-remote.mjs version:status --output pretty

# 平台日志读取与分析
node remote-control-cli/omniroute-remote.mjs logs:console --query level=error --query limit=200 --output pretty
node remote-control-cli/omniroute-remote.mjs logs:detail --query limit=50 --output pretty
node remote-control-cli/omniroute-remote.mjs logs:export --query hours=24 --query type=call-logs --output pretty
node remote-control-cli/omniroute-remote.mjs logs:analyze --hours 24 --limit 500 --output pretty

# 调用任意真实 API 路径
node remote-control-cli/omniroute-remote.mjs raw GET /api/health/ping --output pretty
node remote-control-cli/omniroute-remote.mjs raw PATCH /api/settings --data '{"requireLogin":true}' --yes
```

## AI 自动恢复约定

当命令失败时，AI Agent 应读取 stderr 的 `error.hint` 并自动调整：

- `missing_auth`：补 `--token` 或设置 `OMNIROUTE_API_KEY`。
- `confirmation_required`：如果用户已授权写操作，补 `--yes`；否则先用 `--dry-run`。
- `missing_body`：补 `--data`、`--file` 或 `--stdin`。
- `timeout`：增大 `--timeout` 或先执行 `ping`。
- `server_error`：查看 OmniRoute 服务日志后重试。

## 已映射命令

运行以下命令获取机器可读命令清单：

```bash
node remote-control-cli/omniroute-remote.mjs schema --output pretty
```

当前映射仅使用仓库中已存在的真实端点，例如：

- `/api/health/ping`
- `/api/providers`
- `/api/providers/{id}`
- `/api/providers/{id}/test`
- `/api/models`
- `/api/combos`
- `/api/combos/{id}`
- `/api/settings`
- `/api/cache/stats`
- `/api/provider-metrics`
- `/api/usage/quota`
- `/api/logs/console`
- `/api/logs/detail`
- `/api/logs/{id}`
- `/api/logs/export`
- `/api/version-manager/status`
- `/api/version-manager/start`
- `/api/version-manager/stop`
- `/api/version-manager/restart`
- `/api/shutdown`

## 日志分析输出

`logs:analyze` 会读取 `/api/logs/console` 和 `/api/logs/export?type=call-logs`，在本地汇总：

- `summary`：控制台日志数、调用日志数、错误数、失败调用数、慢请求数、成功率
- `distributions`：组件、错误组件、失败 Provider、失败模型、HTTP 状态分布
- `recentErrors`：最近错误日志摘要
- `recentFailedCalls`：最近失败调用摘要
- `recommendations`：面向排障的下一步建议
