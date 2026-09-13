import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { redactSensitive } from '../src/utils/redaction.js';

// Static/unit verification for V42 (observability). Unlike most previous
// versions, redaction correctness is fully testable without PostgreSQL —
// it's pure string logic — so this suite includes real behavioral
// assertions (not just source-pattern checks) for the redaction fix.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

test('redactSensitive now catches camelCase sensitive keys that previously bypassed redaction entirely', () => {
  const input = { qrPayload: 'secret-payload', fileKey: 'private/doc.pdf', otpCode: '123456', pinHash: 'abc', ok: 'visible' };
  const out = redactSensitive(input);
  assert.strictEqual(out.qrPayload, '[REDACTED]');
  assert.strictEqual(out.fileKey, '[REDACTED]');
  assert.strictEqual(out.otpCode, '[REDACTED]');
  assert.strictEqual(out.pinHash, '[REDACTED]');
  assert.strictEqual(out.ok, 'visible');
});

test('redactSensitive still catches the original snake_case keys (no regression)', () => {
  const input = { password: 'x', pin: '123456', qr_payload: 'secret', file_key: 'private/key', ok: 'visible' };
  const out = redactSensitive(input);
  assert.strictEqual(out.password, '[REDACTED]');
  assert.strictEqual(out.pin, '[REDACTED]');
  assert.strictEqual(out.qr_payload, '[REDACTED]');
  assert.strictEqual(out.file_key, '[REDACTED]');
  assert.strictEqual(out.ok, 'visible');
});

test('redactSensitive does NOT false-positive on legitimate financial/shipping fields (the near-miss caught before shipping)', () => {
  const input = {
    shipping_fee: 2000, shippingFee: 2000, shipping_release: true,
    tracking_code: 'ABC123', trackingCode: 'ABC123',
    postal_code: '90210', country_code: 'ML',
    discipline: 'engineering', opinion: 'positive', spinner: 'loading'
  };
  const out = redactSensitive(input);
  for (const key of Object.keys(input)) {
    assert.notStrictEqual(out[key], '[REDACTED]', `${key} must not be redacted — it is a legitimate, non-sensitive field`);
  }
});

test('redaction fix source documents the false-positive near-miss so it is not silently reintroduced', () => {
  const src = read('src', 'utils', 'redaction.js');
  assert.match(src, /shipping_fee/);
  assert.match(src, /naive substring matching/);
});

test('server.js registers a request-completion logging middleware (previously only errors were ever logged)', () => {
  const src = read('src', 'server.js');
  assert.match(src, /import \{ requestLog \} from '\.\/middleware\/requestLog\.js'/);
  assert.match(src, /app\.use\(requestLog\)/);
});

test('requestLog middleware logs method/path/status/duration/request_id and skips health-check noise, without logging body/headers', () => {
  const src = read('src', 'middleware', 'requestLog.js');
  assert.match(src, /method: req\.method/);
  assert.match(src, /path: req\.path/);
  assert.match(src, /status: res\.statusCode/);
  assert.match(src, /duration_ms:/);
  assert.match(src, /request_id: res\.locals\.requestId/);
  assert.match(src, /req\.path\.endsWith\('\/health'\)/);
  assert.doesNotMatch(src, /req\.body/);
  assert.doesNotMatch(src, /req\.headers/);
});

test('server.js registers top-level uncaughtException and unhandledRejection handlers that log with redaction and exit', () => {
  const src = read('src', 'server.js');
  assert.match(src, /process\.on\('uncaughtException', /);
  assert.match(src, /process\.on\('unhandledRejection', /);
  const handlersBlock = src.split("process.on('uncaughtException'")[1];
  assert.match(handlersBlock, /redactSensitive\(/);
  assert.match(handlersBlock, /process\.exit\(1\)/g);
});

console.log(JSON.stringify({
  test: 'V42_OBSERVABILITY_AUDIT_STATIC',
  note: 'Redaction behavior is fully tested (pure logic). Request-logging and process-handler wiring verified statically; end-to-end log output under a running server was not captured in this environment.',
  result: 'SEE_NODE_TEST_OUTPUT'
}, null, 2));
