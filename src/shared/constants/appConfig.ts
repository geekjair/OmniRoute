import pkg from "../../../package.json" with { type: "json" };

export const APP_CONFIG = {
  name: "OmniRoute",
  description: "AI Gateway for Multi-Provider LLMs",
  version: `${pkg.version}-test`,
  // "YYYYmmdd HHmmss" stamped at build time (next.config.mjs env injection);
  // empty when the module is loaded outside a Next.js build/test harness.
  buildTimestamp: process.env.NEXT_PUBLIC_BUILD_TIMESTAMP ?? "",
};

export const THEME_CONFIG = {
  storageKey: "theme",
  defaultTheme: "system",
};
