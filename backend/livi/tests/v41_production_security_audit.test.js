import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Static/unit verification for V41 (production security audit).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const exists = (...p) => fs.existsSync(path.join(root, ...p));

test('.gitignore exists (it did not before V41) and covers env files, node_modules, and local storage', () => {
  assert.ok(exists('.gitignore'), '.gitignore must exist');
  const gi = read('.gitignore');
  assert.match(gi, /^node_modules\/$/m);
  assert.match(gi, /^\.env$/m);
  assert.match(gi, /^storage\/$/m);
});

test('authLimiter now reads env.AUTH_RATE_LIMIT instead of a hardcoded value the env var silently overrode nothing for', () => {
  const src = read('src', 'middleware', 'security.js');
  assert.match(src, /export const authLimiter = rateLimit\(\{[\s\S]*?limit: env\.AUTH_RATE_LIMIT,/);
  assert.doesNotMatch(src.split('export const authLimiter')[1].split('export const otpLimiter')[0], /limit:\s*12\b/);
});

test('env.js still validates AUTH_RATE_LIMIT with the same default (12) — no behavior change for unconfigured deployments', () => {
  const src = read('src', 'config', 'env.js');
  assert.match(src, /AUTH_RATE_LIMIT: z\.coerce\.number\(\)\.int\(\)\.positive\(\)\.default\(12\)/);
});

test('every env var declared in the Zod schema is actually referenced somewhere in src/ (no more orphaned config)', () => {
  const envSrc = read('src', 'config', 'env.js');
  const declared = [...envSrc.matchAll(/^\s*([A-Z_]+):\s*z\./gm)].map(m => m[1]);
  assert.ok(declared.includes('AUTH_RATE_LIMIT'));

  const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(rel);
    if (entry.name.endsWith('.js')) return [rel];
    return [];
  });
  const allSrc = walk('src').map(f => read(f)).join('\n');

  for (const key of declared) {
    assert.match(allSrc, new RegExp(`env\\.${key}\\b`), `${key} is declared in env.js but never referenced via env.${key} anywhere in src/`);
  }
});

test('webhook signature verification rejects an invalid/missing signature in every environment, not just production (confirmed finding, not a bug)', () => {
  const src = read('src', 'routes', 'webhooks.js');
  // Early short-circuit only fires in production (defense-in-depth /
  // fail-fast), but the transactional path below always rejects on
  // !valid regardless of environment — this is what actually matters.
  assert.match(src, /if\(!valid && env\.NODE_ENV==='production'\) throw new HttpError\(401,'Signature webhook invalide','WEBHOOK_SIGNATURE_INVALID'\);/);
  assert.match(src, /if\(!valid\)\{[\s\S]*?throw new HttpError\(401,'Signature webhook invalide','WEBHOOK_SIGNATURE_INVALID'\);/);
  // No secret configured must also fail closed, not open.
  assert.match(src, /if\(!env\.PAYMENT_WEBHOOK_SECRET \|\| !signature\) return false;/);
});

test('no committed .env file and no hardcoded secret-looking literals in src/', () => {
  assert.ok(!exists('.env'), 'a real .env must never be committed');
  const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(rel);
    if (entry.name.endsWith('.js')) return [rel];
    return [];
  });
  const allSrc = walk('src').map(f => read(f)).join('\n');
  assert.doesNotMatch(allSrc, /(secret|password|api[_-]?key)\s*[:=]\s*['"][A-Za-z0-9+/=_-]{16,}['"]/i);
});

console.log(JSON.stringify({
  test: 'V41_PRODUCTION_SECURITY_AUDIT_STATIC',
  note: 'Pure static audit — no PostgreSQL or network dependency for this version.',
  result: 'SEE_NODE_TEST_OUTPUT'
}, null, 2));
