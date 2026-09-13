import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// V44 — CI/CD preparation finding: `npm run test:all` was defined as
// `node --test tests/**/*.test.js`. That `**` glob relies entirely on the
// invoking shell to expand it recursively — and the shell npm actually
// uses to run package.json scripts on Linux (including every standard
// GitHub Actions Ubuntu runner) is `/bin/sh`, which on this system (and
// on GitHub's runners) is `dash`. dash does not support `**` as a
// recursive glob at all; without bash's `globstar` option even bash
// itself doesn't expand it that way by default. Reproduced directly in
// this environment: `npm run test:all` silently ran exactly ONE test file
// (tests/integration/ledger-finance.integration.test.js) out of 130+,
// and reported success/failure based on that single file alone. A CI
// pipeline built on this script would have given a green check while
// running almost none of the test suite.
//
// The obvious alternative — `node --test` with no path argument, relying
// on Node's own default recursive discovery from the working directory —
// is not a safe fix either: Node's default test-file heuristics also
// match any file whose name ends in `-test.js` or `_test.js`, not only
// `*.test.js`. That silently swept up `scripts/v31-postgres-crash-test.js`
// (a standalone script meant to run against a real PostgreSQL instance,
// not a node:test suite) into the unit-test run, where it fails for
// unrelated environmental reasons (no `pg` package / no database) and
// pollutes the pass/fail count with a false signal.
//
// This script is the precise, portable fix: it walks `tests/` itself
// (plain fs.readdirSync, no shell glob, no Node test-runner heuristics),
// collects every `*.test.js` file at any depth, and passes that explicit,
// verified file list to `node --test`. Shell-independent by construction
// — works identically under dash, bash, zsh, or any CI runner.

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const testsDir = path.join(root, 'tests');

function collect(dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(collect(full));
    else if (entry.name.endsWith('.test.js')) out.push(full);
  }
  return out;
}

const files = collect(testsDir).sort();

if (files.length === 0) {
  console.error('collect-unit-tests: no test files found under tests/ — refusing to report a false PASS');
  process.exit(1);
}

console.log(`collect-unit-tests: running ${files.length} test file(s) found under tests/`);

try {
  // V44 robustness fix, found while testing this very file: Node's own
  // test runner sets NODE_TEST_CONTEXT (and related internal signaling)
  // in the environment of any test file it runs as a subprocess. If this
  // script is itself invoked from inside another `node --test` run (which
  // is exactly what tests/v44_ci_cd_preparation.test.js does to verify
  // this script's real behavior), that variable leaks into the `node
  // --test` child spawned below and makes it behave as if IT were a
  // coordinated subprocess of some other parent test runner — it silently
  // stops producing normal TAP output on stdout instead of running
  // normally. Stripping NODE_TEST_* from the child's environment makes
  // this script's behavior identical whether it's run standalone (`npm
  // run test:all`, CI) or nested inside another test run.
  const childEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('NODE_TEST_')));
  execFileSync(process.execPath, ['--test', ...files.map(f => path.relative(root, f))], {
    cwd: root,
    stdio: 'inherit',
    env: childEnv
  });
} catch (e) {
  process.exitCode = e.status || 1;
}
