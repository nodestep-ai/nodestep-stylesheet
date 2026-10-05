import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PACKAGE, read, ROOT } from "./support.ts";

function job(workflow: string, name: string): string {
  const parts = workflow.split(`\n  ${name}:\n`);
  assert.equal(parts.length, 2, `the workflow has no ${name} job`);
  return parts[1].split(/\n  [\w-]+:\n/)[0];
}

test("package.json only names the repository and runs node:test", () => {
  assert.deepEqual(Object.keys(PACKAGE), [
    "name",
    "private",
    "type",
    "engines",
    "scripts",
  ]);
  assert.equal(PACKAGE.name, "nodestep-stylesheet");
  assert.equal(PACKAGE.private, true);
  assert.equal(PACKAGE.type, "module");
  assert.equal(PACKAGE.engines.node, ">=22.18");
  assert.deepEqual(PACKAGE.scripts, { test: "node --test" });
});

test("the repository has no packages, no Svelte and no TypeScript build", () => {
  for (const file of [
    "package-lock.json",
    "node_modules",
    "tsconfig.json",
    "svelte",
    ".svelte-check",
    "tests/svelte.test.ts",
  ]) {
    assert.ok(!existsSync(new URL(file, ROOT)), file);
  }
  assert.doesNotMatch(read(".gitignore"), /svelte/);
});

test("the repository has no Python parts", () => {
  for (const file of ["pyproject.toml", "uv.lock", ".python-version"]) {
    assert.ok(!existsSync(new URL(file, ROOT)), file);
  }
  assert.deepEqual(
    readdirSync(new URL("tests/", ROOT)).filter((name) => name.endsWith(".py")),
    [],
  );
});

test("CI runs node --test with no install step", () => {
  const tests = job(read(".github/workflows/ci.yml"), "test");
  assert.ok(
    tests.includes(
      "uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0",
    ),
  );
  assert.match(tests, /node-version: "24"/);
  assert.deepEqual(
    [...tests.matchAll(/\brun: (.+)/g)].map((match) => match[1]),
    ["node --test"],
  );
  assert.doesNotMatch(tests, /npm|svelte|setup-uv|pytest/);
});

test("a release attaches the stylesheet and both scripts", () => {
  const release = read(".github/workflows/release.yml");
  assert.match(
    release,
    /gh release create "v\$VERSION" nodestep\.css nodestep-theme\.js nodestep-data\.js /,
  );
});
