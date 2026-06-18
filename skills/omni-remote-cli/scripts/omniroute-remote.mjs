#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const VERSION = "0.1.0";
const DEFAULT_BASE_URL = "http://127.0.0.1:20128";
const CONFIG_PATH = join(homedir(), ".omniroute", "remote-cli.json");
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const COMMANDS = [
  {
    name: "ping",
    method: "GET",
    path: "/api/health/ping",
    auth: false,
    description: "检查 OmniRoute 平台存活状态",
  },
  {
    name: "auth-status",
    method: "GET",
    path: "/api/auth/status",
    auth: false,
    description: "查看 Dashboard Cookie 登录状态",
  },
  {
    name: "providers:list",
    method: "GET",
    path: "/api/providers",
    auth: true,
    description: "列出 Provider 连接",
  },
  {
    name: "providers:get",
    method: "GET",
    path: "/api/providers/{id}",
    auth: true,
    params: ["id"],
    description: "查看单个 Provider 连接",
  },
  {
    name: "providers:test",
    method: "POST",
    path: "/api/providers/{id}/test",
    auth: true,
    params: ["id"],
    write: true,
    description: "测试单个 Provider 连接",
  },
  {
    name: "models:list",
    method: "GET",
    path: "/api/models",
    auth: true,
    description: "列出可用模型",
  },
  {
    name: "combos:list",
    method: "GET",
    path: "/api/combos",
    auth: true,
    description: "列出 Combo 路由配置",
  },
  {
    name: "combos:get",
    method: "GET",
    path: "/api/combos/{id}",
    auth: true,
    params: ["id"],
    description: "查看单个 Combo",
  },
  {
    name: "combos:create",
    method: "POST",
    path: "/api/combos",
    auth: true,
    body: true,
    write: true,
    description: "创建 Combo",
  },
  {
    name: "combos:update",
    method: "PUT",
    path: "/api/combos/{id}",
    auth: true,
    params: ["id"],
    body: true,
    write: true,
    description: "更新 Combo",
  },
  {
    name: "combos:delete",
    method: "DELETE",
    path: "/api/combos/{id}",
    auth: true,
    params: ["id"],
    write: true,
    description: "删除 Combo",
  },
  {
    name: "settings:get",
    method: "GET",
    path: "/api/settings",
    auth: true,
    description: "读取平台设置",
  },
  {
    name: "settings:patch",
    method: "PATCH",
    path: "/api/settings",
    auth: true,
    body: true,
    write: true,
    description: "局部更新平台设置",
  },
  {
    name: "cache:stats",
    method: "GET",
    path: "/api/cache/stats",
    auth: true,
    description: "读取 Prompt Cache 统计",
  },
  {
    name: "cache:clear",
    method: "DELETE",
    path: "/api/cache/stats",
    auth: true,
    write: true,
    description: "清空 Prompt Cache",
  },
  {
    name: "metrics:providers",
    method: "GET",
    path: "/api/provider-metrics",
    auth: false,
    description: "读取 Provider 指标快照",
  },
  {
    name: "usage:quota",
    method: "GET",
    path: "/api/usage/quota",
    auth: true,
    description: "读取配额使用情况",
  },
  {
    name: "version:status",
    method: "GET",
    path: "/api/version-manager/status",
    auth: true,
    description: "查看受管工具运行状态",
  },
  {
    name: "version:start",
    method: "POST",
    path: "/api/version-manager/start",
    auth: true,
    body: true,
    write: true,
    description: "启动受管工具",
  },
  {
    name: "version:stop",
    method: "POST",
    path: "/api/version-manager/stop",
    auth: true,
    body: true,
    write: true,
    description: "停止受管工具",
  },
  {
    name: "version:restart",
    method: "POST",
    path: "/api/version-manager/restart",
    auth: true,
    body: true,
    write: true,
    description: "重启受管工具",
  },
  {
    name: "shutdown",
    method: "POST",
    path: "/api/shutdown",
    auth: true,
    write: true,
    dangerous: true,
    description: "关闭 OmniRoute 服务进程",
  },
];

function main(argv) {
  const parsed = parseArgs(argv);
  if (parsed.flags.help || !parsed.command) {
    return printHelp();
  }
  if (parsed.flags.version) {
    return writeData({ ok: true, data: { version: VERSION } }, parsed.flags);
  }

  switch (parsed.command) {
    case "commands":
      return writeData({ ok: true, data: COMMANDS }, parsed.flags);
    case "schema":
      return writeData({ ok: true, data: buildSchema() }, parsed.flags);
    case "config:init":
      return configInit(parsed.flags);
    case "config:show":
      return configShow(parsed.flags);
    case "config:set":
      return configSet(parsed.args, parsed.flags);
    case "config:unset":
      return configUnset(parsed.args, parsed.flags);
    case "raw":
      return runRaw(parsed.args, parsed.flags);
    default:
      return runMapped(parsed.command, parsed.args, parsed.flags);
  }
}

async function runMapped(commandName, args, flags) {
  const command = COMMANDS.find((item) => item.name === commandName);
  if (!command) {
    throw cliError(
      "unknown_command",
      `未知命令: ${commandName}`,
      "运行 `omniroute-remote commands` 查看可用命令。",
      2
    );
  }
  const pathParams = readPathParams(command, args, flags);
  const requestPath = fillPath(command.path, pathParams);
  return request({
    method: command.method,
    path: requestPath,
    auth: command.auth,
    bodyRequired: command.body,
    write: command.write || WRITE_METHODS.has(command.method),
    dangerous: command.dangerous,
    flags,
  });
}

async function runRaw(args, flags) {
  const method = String(args[0] || flags.method || "GET").toUpperCase();
  const path = args[1] || flags.path;
  if (!path) {
    throw cliError(
      "missing_argument",
      "raw 命令缺少路径",
      "示例: omniroute-remote raw GET /api/health/ping",
      2
    );
  }
  return request({
    method,
    path,
    auth: flags.auth !== false,
    bodyRequired: Boolean(flags.data || flags.file || flags.stdin),
    write: WRITE_METHODS.has(method),
    dangerous: Boolean(flags.dangerous),
    flags,
  });
}

async function request({ method, path, auth, bodyRequired, write, dangerous, flags }) {
  const config = readConfig();
  const baseUrl = normalizeBaseUrl(
    flags.url || process.env.OMNIROUTE_REMOTE_URL || config.url || DEFAULT_BASE_URL
  );
  const token =
    flags.token ||
    process.env.OMNIROUTE_API_KEY ||
    process.env.OMNIROUTE_REMOTE_TOKEN ||
    config.token;
  const timeoutMs = numberFlag(flags.timeout, config.timeoutMs || 30000);
  const dryRun = Boolean(flags["dry-run"]);

  if (auth && !token && !dryRun) {
    throw cliError(
      "missing_auth",
      "缺少远程控制 Token",
      "通过 `--token`、环境变量 OMNIROUTE_API_KEY，或 `config:set token <value>` 提供具备 manage scope 的 API key。",
      2
    );
  }
  if (write && !dryRun && !flags.yes) {
    throw cliError(
      "confirmation_required",
      "写操作需要显式确认",
      "追加 `--yes` 执行，或追加 `--dry-run` 只预览请求。",
      2
    );
  }
  if (dangerous && !dryRun && flags.yes !== "danger") {
    throw cliError(
      "dangerous_confirmation_required",
      "高风险操作需要二次确认",
      "关闭服务请使用 `--yes danger`，或先用 `--dry-run` 预览。",
      2
    );
  }

  const url = new URL(path.startsWith("/") ? path : `/${path}`, baseUrl);
  applyQuery(url, flags.query);
  const body = await readBody(flags, bodyRequired);
  const headers = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (auth && token) {
    headers.authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
    headers["x-api-key"] = token.replace(/^Bearer\s+/i, "");
  }

  const preview = {
    method,
    url: url.toString(),
    headers: maskHeaders(headers),
    body: body === undefined ? null : JSON.parse(body),
  };
  if (dryRun) {
    return writeData({ ok: true, data: preview, _meta: meta("dry_run") }, flags);
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  let responseText;
  try {
    response = await fetch(url, { method, headers, body, signal: controller.signal });
    responseText = await response.text();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw cliError(
        "timeout",
        `请求超时: ${timeoutMs}ms`,
        "增大 `--timeout`，或检查 OmniRoute 服务是否可达。",
        124
      );
    }
    throw cliError(
      "network_error",
      String(error?.message || error),
      "检查 `--url`、网络、隧道或 OmniRoute 服务状态。",
      1
    );
  } finally {
    clearTimeout(timer);
  }

  const parsed = parseJsonMaybe(responseText);
  const payload = {
    ok: response.ok,
    data: response.ok ? parsed : null,
    error: response.ok
      ? undefined
      : {
          type: classifyHttpError(response.status),
          message: extractErrorMessage(parsed, response.statusText),
          hint: hintForStatus(response.status),
          status: response.status,
        },
    _meta: {
      command: "request",
      method,
      url: url.toString(),
      status: response.status,
      elapsedMs: Date.now() - startedAt,
    },
  };

  writeData(payload, flags);
  return response.ok ? 0 : 1;
}

function configInit(flags) {
  const existing = readConfig();
  const next = {
    url: flags.url || existing.url || DEFAULT_BASE_URL,
    token: flags.token || existing.token || "",
    timeoutMs: numberFlag(flags.timeout, existing.timeoutMs || 30000),
  };
  writeConfig(next);
  return writeData({ ok: true, data: redactConfig(next), _meta: meta("config:init") }, flags);
}

function configShow(flags) {
  return writeData(
    { ok: true, data: redactConfig(readConfig()), _meta: meta("config:show") },
    flags
  );
}

function configSet(args, flags) {
  const [key, ...rest] = args;
  const value = rest.join(" ");
  if (!key || !value) {
    throw cliError(
      "missing_argument",
      "config:set 需要 key 和 value",
      "示例: omniroute-remote config:set url http://host:20128",
      2
    );
  }
  if (!["url", "token", "timeoutMs"].includes(key)) {
    throw cliError(
      "invalid_config_key",
      `不支持的配置键: ${key}`,
      "可用键: url, token, timeoutMs。",
      2
    );
  }
  const config = readConfig();
  config[key] = key === "timeoutMs" ? numberFlag(value, 30000) : value;
  writeConfig(config);
  return writeData({ ok: true, data: redactConfig(config), _meta: meta("config:set") }, flags);
}

function configUnset(args, flags) {
  const key = args[0];
  if (!key) {
    throw cliError(
      "missing_argument",
      "config:unset 需要 key",
      "示例: omniroute-remote config:unset token",
      2
    );
  }
  const config = readConfig();
  delete config[key];
  writeConfig(config);
  return writeData({ ok: true, data: redactConfig(config), _meta: meta("config:unset") }, flags);
}

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      positional.push(...argv.slice(index + 1));
      break;
    }
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      const key = arg.slice(2, eq >= 0 ? eq : undefined);
      if (eq >= 0) {
        setFlag(flags, key, arg.slice(eq + 1));
      } else {
        const next = argv[index + 1];
        if (next && !next.startsWith("--") && !isBooleanFlag(key)) {
          setFlag(flags, key, next);
          index += 1;
        } else {
          setFlag(flags, key, true);
        }
      }
      continue;
    }
    positional.push(arg);
  }
  return {
    command: positional[0],
    args: positional.slice(1),
    flags,
  };
}

function setFlag(flags, key, value) {
  if (key === "query") {
    flags.query = flags.query ? [].concat(flags.query, value) : value;
    return;
  }
  flags[key] = value;
}

function isBooleanFlag(key) {
  return ["help", "version", "dry-run", "stdin", "auth", "dangerous"].includes(key);
}

function readPathParams(command, args, flags) {
  const params = {};
  for (const [index, name] of (command.params || []).entries()) {
    const value = flags[name] || args[index];
    if (!value) {
      throw cliError(
        "missing_argument",
        `缺少路径参数: ${name}`,
        `示例: omniroute-remote ${command.name} <${name}>`,
        2
      );
    }
    params[name] = value;
  }
  return params;
}

function fillPath(path, params) {
  return path.replace(/\{([^}]+)\}/g, (_, key) => encodeURIComponent(params[key]));
}

async function readBody(flags, bodyRequired) {
  if (flags.data) return JSON.stringify(parseJsonStrict(flags.data, "--data"));
  if (flags.file)
    return JSON.stringify(parseJsonStrict(readFileSync(flags.file, "utf8"), flags.file));
  if (flags.stdin) return JSON.stringify(parseJsonStrict(await readStdin(), "stdin"));
  if (bodyRequired) {
    throw cliError(
      "missing_body",
      "命令需要 JSON 请求体",
      "使用 `--data '{...}'`、`--file body.json` 或 `--stdin`。",
      2
    );
  }
  return undefined;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let text = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      text += chunk;
    });
    process.stdin.on("end", () => resolve(text));
    process.stdin.on("error", reject);
  });
}

function applyQuery(url, query) {
  if (!query) return;
  for (const item of [].concat(query)) {
    const [key, ...rest] = String(item).split("=");
    if (!key || rest.length === 0) {
      throw cliError(
        "invalid_query",
        `查询参数格式错误: ${item}`,
        "使用 `--query key=value`，可重复传入。",
        2
      );
    }
    url.searchParams.set(key, rest.join("="));
  }
}

function parseJsonStrict(text, source) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw cliError(
      "invalid_json",
      `${source} 不是合法 JSON`,
      "检查引号、逗号和转义字符；也可改用 `--file` 降低 shell 转义风险。",
      2
    );
  }
}

function parseJsonMaybe(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractErrorMessage(body, fallback) {
  if (!body) return fallback || "Request failed";
  if (typeof body === "string") return body;
  if (typeof body.error === "string") return body.error;
  if (body.error?.message) return body.error.message;
  if (body.message) return body.message;
  return fallback || "Request failed";
}

function classifyHttpError(status) {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return "http_error";
}

function hintForStatus(status) {
  if (status === 401) return "提供有效 `--token` 或运行 `config:set token <key>`。";
  if (status === 403) return "确认 API key 有 manage scope，且未过期。";
  if (status === 404) return "确认资源 ID 和 OmniRoute 版本中的 API 路径。";
  if (status === 409) return "按服务端错误说明调整资源状态后重试。";
  if (status === 429) return "稍后重试，或检查平台限流配置。";
  if (status >= 500) return "查看 OmniRoute 服务日志，并重试相同命令。";
  return "检查请求参数和 JSON 请求体。";
}

function writeData(payload, flags = {}) {
  const output = flags.output || "json";
  if (output === "pretty") {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return payload.ok ? 0 : 1;
  }
  if (output !== "json") {
    throw cliError(
      "invalid_output",
      `不支持的输出格式: ${output}`,
      "可用输出格式: json, pretty。",
      2
    );
  }
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  return payload.ok ? 0 : 1;
}

function writeError(error) {
  const body = {
    ok: false,
    error: {
      type: error.type || "error",
      message: error.message || String(error),
      hint: error.hint || "查看 `--help` 或 `commands` 输出。",
    },
  };
  process.stderr.write(`${JSON.stringify(body)}\n`);
  return error.exitCode || 1;
}

function printHelp() {
  const lines = [
    "OmniRoute Remote CLI — AI 友好的远程控制命令行",
    "",
    "用法:",
    "  omniroute-remote <command> [args] [--flags]",
    "",
    "核心命令:",
    "  ping                         检查平台存活",
    "  providers:list               列出 Provider 连接",
    "  providers:test <id> --yes    测试 Provider 连接",
    "  models:list --query all=true  列出模型",
    "  combos:list                  列出 Combo",
    "  combos:get <id>              查看 Combo",
    "  settings:get                 读取设置",
    "  cache:stats                  查看缓存统计",
    "  version:status               查看受管工具状态",
    "  raw METHOD PATH              调用任意平台 API",
    "",
    "配置命令:",
    "  config:init --url <url> --token <key>",
    "  config:show",
    "  config:set url <url>",
    "  config:set token <key>",
    "",
    "AI 契约:",
    '  stdout 只输出 JSON envelope: {"ok":true,"data":...}',
    '  stderr 只输出结构化错误: {"ok":false,"error":{"type","message","hint"}}',
    "  写操作必须传 --yes；高风险 shutdown 必须传 --yes danger；可用 --dry-run 预览。",
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  return 0;
}

function buildSchema() {
  return {
    version: VERSION,
    stdout: "JSON envelope only",
    stderr: "diagnostics and JSON error envelope only",
    success: { ok: true, data: "any", _meta: "object optional" },
    failure: { ok: false, error: { type: "string", message: "string", hint: "string" } },
    configPriority: ["flags", "env", CONFIG_PATH, "defaults"],
    auth: {
      headers: ["Authorization: Bearer <token>", "x-api-key: <token>"],
      env: ["OMNIROUTE_API_KEY", "OMNIROUTE_REMOTE_TOKEN"],
    },
    commands: COMMANDS,
  };
}

function readConfig() {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    throw cliError(
      "invalid_config",
      `配置文件无法解析: ${CONFIG_PATH}`,
      "修复 JSON 格式，或删除后运行 `config:init`。",
      2
    );
  }
}

function writeConfig(config) {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

function redactConfig(config) {
  return {
    ...config,
    token: config.token
      ? `${String(config.token).slice(0, 6)}...${String(config.token).slice(-4)}`
      : "",
    path: CONFIG_PATH,
  };
}

function maskHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      /authorization|api-key/i.test(key) ? "***" : value,
    ])
  );
}

function normalizeBaseUrl(value) {
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw cliError(
      "invalid_url",
      `URL 无效: ${value}`,
      "使用完整 URL，例如 http://127.0.0.1:20128。",
      2
    );
  }
}

function numberFlag(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw cliError("invalid_number", `数字参数无效: ${value}`, "请传入大于 0 的数字。", 2);
  }
  return number;
}

function meta(command) {
  return { command, version: VERSION };
}

function cliError(type, message, hint, exitCode = 1) {
  const error = new Error(message);
  error.type = type;
  error.hint = hint;
  error.exitCode = exitCode;
  return error;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : true;
if (invokedPath) {
  Promise.resolve(main(process.argv.slice(2)))
    .then((exitCode) => {
      process.exit(typeof exitCode === "number" ? exitCode : 0);
    })
    .catch((error) => {
      process.exit(writeError(error));
    });
}
