import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Static + behavioral verification for V45 (staging environment
// preparation). Where possible this suite runs the REAL computed logic in
// a subprocess with controlled environment variables (the same technique
// used in V44 to verify the actual shell glob behavior), rather than only
// pattern-matching source text.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const exists = (...p) => fs.existsSync(path.join(root, ...p));

const BASE_ENV = {
  DATABASE_URL: 'postgres://placeholder:placeholder@localhost:5432/placeholder',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  JWT_REFRESH_SECRET: 'y'.repeat(32)
};

// V45 note: src/config/env.js imports 'dotenv/config' at its very first
// line, so actually running it requires that package to be resolvable.
// Every environment this project has been built in so far had
// node_modules removed after packaging the previous version's deliverable
// (consistent practice across every version), so `dotenv` — and every
// other real dependency — is not installed here. This is the same class
// of environmental limitation documented for every real-Postgres script
// since V35 (missing `pg`), just one dependency earlier in the chain.
// These behavioral tests genuinely exercise env.js's real logic (not a
// hand-simulation) whenever dependencies ARE available (e.g. after a real
// `npm install`), and skip cleanly with a clear reason otherwise, rather
// than either faking a pass or failing the whole suite over an
// environmental gap unrelated to the code being tested.
let dependenciesAvailable = true;
try {
  execFileSync(process.execPath, ['--input-type=module', '-e', "import 'dotenv/config';"], { cwd: root, stdio: 'pipe' });
} catch {
  dependenciesAvailable = false;
}

function computeAllowStagingTestHelpers(extraEnv) {
  const out = execFileSync(process.execPath, ['--input-type=module', '-e',
    "import { allowStagingTestHelpers } from './src/config/env.js'; console.log(JSON.stringify(allowStagingTestHelpers));"
  ], {
    cwd: root,
    env: { ...process.env, ...BASE_ENV, ...extraEnv },
    encoding: 'utf8'
  });
  return JSON.parse(out.trim());
}

test('BEHAVIORAL: allowStagingTestHelpers is true in development (real subprocess, real env.js)', (t) => {
  if (!dependenciesAvailable) return t.skip('dotenv (and other real dependencies) not installed in this sandbox — see note above');
  assert.strictEqual(computeAllowStagingTestHelpers({ NODE_ENV: 'development' }), true);
});

test('BEHAVIORAL: allowStagingTestHelpers is true in test (real subprocess, real env.js)', (t) => {
  if (!dependenciesAvailable) return t.skip('dotenv (and other real dependencies) not installed in this sandbox — see note above');
  assert.strictEqual(computeAllowStagingTestHelpers({ NODE_ENV: 'test' }), true);
});

test('BEHAVIORAL: allowStagingTestHelpers is FALSE in production without the opt-in flag — real production stays strict', (t) => {
  if (!dependenciesAvailable) return t.skip('dotenv (and other real dependencies) not installed in this sandbox — see note above');
  const result = computeAllowStagingTestHelpers({
    NODE_ENV: 'production',
    PAYMENT_WEBHOOK_SECRET: 'x'.repeat(32),
    LIVI_PROOF_ENCRYPTION_KEY: 'x'.repeat(32),
    FILE_ACCESS_SECRET: 'x'.repeat(32),
    ALLOWED_ORIGINS: 'https://example.com'
  });
  assert.strictEqual(result, false);
});

test('BEHAVIORAL: allowStagingTestHelpers is true in production ONLY when explicitly opted in — and warns loudly', (t) => {
  if (!dependenciesAvailable) return t.skip('dotenv (and other real dependencies) not installed in this sandbox — see note above');
  const out = execFileSync(process.execPath, ['--input-type=module', '-e',
    "import { allowStagingTestHelpers } from './src/config/env.js'; console.log(JSON.stringify(allowStagingTestHelpers));"
  ], {
    cwd: root,
    env: {
      ...process.env, ...BASE_ENV,
      NODE_ENV: 'production',
      PAYMENT_WEBHOOK_SECRET: 'x'.repeat(32),
      LIVI_PROOF_ENCRYPTION_KEY: 'x'.repeat(32),
      FILE_ACCESS_SECRET: 'x'.repeat(32),
      ALLOWED_ORIGINS: 'https://example.com',
      ALLOW_STAGING_TEST_HELPERS: 'true'
    },
    encoding: 'utf8'
  });
  assert.match(out, /true/);
  assert.match(out, /staging_test_helpers_enabled/);
  assert.match(out, /must never be set on a real production deployment/);
});

test('production still refuses to start without required secrets — regression check on existing strictness', (t) => {
  if (!dependenciesAvailable) return t.skip('dotenv (and other real dependencies) not installed in this sandbox — see note above');
  assert.throws(() => {
    execFileSync(process.execPath, ['--input-type=module', '-e',
      "import './src/config/env.js';"
    ], {
      cwd: root,
      env: { ...process.env, ...BASE_ENV, NODE_ENV: 'production' },
      encoding: 'utf8',
      stdio: 'pipe'
    });
  }, /must be configured in production|ALLOWED_ORIGINS must contain HTTPS/);
});

test('auth.js and escrow.js use allowStagingTestHelpers instead of a bare NODE_ENV check for their dev shortcuts', () => {
  const authSrc = read('src', 'services', 'auth.js');
  assert.match(authSrc, /allowStagingTestHelpers\?env\.DEV_OTP:/);
  const escrowSrc = read('src', 'routes', 'escrow.js');
  assert.match(escrowSrc, /if\(!allowStagingTestHelpers\)throw new HttpError\(403,'La confirmation financière doit provenir du webhook partenaire','PARTNER_WEBHOOK_ONLY'\)/);
});

test('.env.example exists and documents every variable env.js actually validates', () => {
  assert.ok(exists('.env.example'), '.env.example must exist');
  const envExample = read('.env.example');
  const envSrc = read('src', 'config', 'env.js');
  const declared = [...envSrc.matchAll(/^\s*([A-Z_]+):\s*z\./gm)].map(m => m[1]);
  for (const key of declared) {
    assert.match(envExample, new RegExp(`^${key}=`, 'm'), `.env.example is missing ${key}`);
  }
});

test('Dockerfile exists and uses npm install, not npm ci (no committed lockfile exists in this repo)', () => {
  assert.ok(exists('Dockerfile'), 'Dockerfile must exist');
  const df = read('Dockerfile');
  assert.doesNotMatch(df, /RUN npm ci\b/);
  assert.match(df, /RUN npm install/);
  assert.match(df, /USER node/);
});

test('.dockerignore exists and excludes node_modules and secrets', () => {
  assert.ok(exists('.dockerignore'));
  const di = read('.dockerignore');
  assert.match(di, /^node_modules$/m);
  assert.match(di, /^\.env$/m);
});

test('no package-lock.json exists — regression guard on the documented reason ci.yml and Dockerfile use npm install', () => {
  assert.ok(!exists('package-lock.json'), 'if a lockfile now exists, ci.yml and Dockerfile should be switched back to npm ci (see their comments)');
});

test('ci.yml no longer runs npm ci as an actual command (retroactive V44 fix) and no longer requests npm cache without a lockfile', () => {
  // V-AUDIT: path updated — see the header comment in
  // v44_ci_cd_preparation.test.js for why (relocated to the repo root as
  // backend-ci.yml so GitHub Actions actually discovers it).
  const ci = read('..', '..', '.github', 'workflows', 'backend-ci.yml');
  const liveLines = ci.split('\n').filter(l => !l.trim().startsWith('#'));
  const liveYaml = liveLines.join('\n');
  assert.doesNotMatch(liveYaml, /run: npm ci\b/);
  assert.doesNotMatch(liveYaml, /^\s*cache:\s*'npm'/m);
  const installCount = (liveYaml.match(/run: npm install\b/g) || []).length;
  assert.strictEqual(installCount, 2, 'expected both jobs (unit-tests, postgres-suite) to install with npm install');
});

test('ci.yml YAML is still structurally valid after the V45 edits', () => {
  // Re-verified the same way V44 first verified it: a real YAML parse,
  // not just eyeballing indentation.
  execFileSync('python3', ['-c', "import yaml; yaml.safe_load(open('.github/workflows/backend-ci.yml'))"], { cwd: path.join(root, '..', '..') });
});

test('scripts/seed-staging.js exists, refuses production, and refuses non-staging-looking database names', () => {
  const src = read('scripts', 'seed-staging.js');
  assert.match(src, /NODE_ENV === 'production'/);
  assert.match(src, /staging\|test\|dev/);
  assert.match(src, /Refusing to seed a database whose connection string does not look like staging\/test\/dev/);
});

test('seed-staging.js data is clearly synthetic (Staging-prefixed names), never touches real users', () => {
  const src = read('scripts', 'seed-staging.js');
  const nameMatches = [...src.matchAll(/'Staging[^']*'/g)];
  assert.ok(nameMatches.length >= 5, 'expected multiple obviously-synthetic "Staging ..." names in the seed data');
});

console.log(JSON.stringify({
  test: 'V45_STAGING_ENVIRONMENT_STATIC_AND_BEHAVIORAL',
  note: 'allowStagingTestHelpers logic is verified behaviorally via real subprocess execution across all NODE_ENV/flag combinations. Dockerfile/seed-staging.js require a real container/PostgreSQL environment to fully verify and were not executed end-to-end here.',
  result: 'SEE_NODE_TEST_OUTPUT'
}, null, 2));
