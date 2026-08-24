// Build timestamp shown in the sidebar footer ("YYYYmmdd HHmmss"). Evaluated
// once per `next build`/`next dev` config load, so every fresh build stamps
// the current time without manual maintenance. CI can pin the value via
// NEXT_PUBLIC_BUILD_TIMESTAMP for reproducible artifacts.

/** Zero-pads a number to two digits. */
function pad2(value) {
  return String(value).padStart(2, "0");
}

/** Formats a Date as "YYYYmmdd HHmmss" (local time), e.g. "20260824 143025". */
export function formatBuildTimestamp(date) {
  return (
    `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}` +
    ` ${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`
  );
}

/**
 * Resolves the build timestamp from the environment, falling back to the
 * given Date (callers pass `new Date()` at config-load time).
 */
export function resolveBuildTimestamp(env, now = new Date()) {
  const explicit =
    typeof env?.NEXT_PUBLIC_BUILD_TIMESTAMP === "string"
      ? env.NEXT_PUBLIC_BUILD_TIMESTAMP.trim()
      : "";
  return explicit || formatBuildTimestamp(now);
}
