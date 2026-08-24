// Sidebar-footer build timestamp — format + config plumbing.
// See scripts/build/buildTimestamp.mjs and src/shared/constants/appConfig.ts.
import test from "node:test";
import assert from "node:assert/strict";
import {
  formatBuildTimestamp,
  resolveBuildTimestamp,
} from "../../scripts/build/buildTimestamp.mjs";
import { APP_CONFIG } from "../../src/shared/constants/appConfig.ts";

test("formatBuildTimestamp renders zero-padded 'YYYYmmdd HHmmss'", () => {
  // Month is 0-based; every field here is single-digit to prove padding.
  assert.equal(formatBuildTimestamp(new Date(2026, 0, 5, 3, 7, 9)), "20260105 030709");
});

test("formatBuildTimestamp keeps multi-digit fields without padding artifacts", () => {
  assert.equal(formatBuildTimestamp(new Date(2026, 11, 31, 23, 59, 59)), "20261231 235959");
  assert.equal(formatBuildTimestamp(new Date(2026, 8, 24, 14, 30, 25)), "20260924 143025");
});

test("resolveBuildTimestamp prefers an explicit NEXT_PUBLIC_BUILD_TIMESTAMP override", () => {
  assert.equal(
    resolveBuildTimestamp({ NEXT_PUBLIC_BUILD_TIMESTAMP: "20260101 000000" }, new Date(2026, 5, 1)),
    "20260101 000000"
  );
});

test("resolveBuildTimestamp trims whitespace from the override", () => {
  assert.equal(
    resolveBuildTimestamp({ NEXT_PUBLIC_BUILD_TIMESTAMP: "  20260101 000000  " }, new Date()),
    "20260101 000000"
  );
});

test("resolveBuildTimestamp falls back to the current date when unset", () => {
  assert.equal(resolveBuildTimestamp({}, new Date(2026, 0, 5, 3, 7, 9)), "20260105 030709");
  assert.equal(resolveBuildTimestamp(undefined, new Date(2026, 0, 5, 3, 7, 9)), "20260105 030709");
});

test("resolveBuildTimestamp ignores a blank override and stamps the fallback time", () => {
  assert.equal(
    resolveBuildTimestamp({ NEXT_PUBLIC_BUILD_TIMESTAMP: "   " }, new Date(2026, 0, 5, 3, 7, 9)),
    "20260105 030709"
  );
});

test("APP_CONFIG.buildTimestamp is empty or a 'YYYYmmdd HHmmss' stamp", () => {
  // Outside a Next.js build (plain node:test) the env injection is absent, so
  // the field degrades to "" rather than a bogus value.
  assert.match(APP_CONFIG.buildTimestamp, /^(\d{8} \d{6})?$/);
});
