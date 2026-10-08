import { test } from "node:test";
import { execFileSync } from "node:child_process";

// Ports (android/) test against these files, so they must match the current JS.
test("tests/fixtures are up to date", () => {
  execFileSync(process.execPath, ["scripts/make-fixtures.js", "--check"], { stdio: "pipe" });
});
