import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

// V-AUDIT (section 34 — KYC document type validation). Cannot import
// routes/kyc.js or routes/compatibility.js directly: both transitively
// pull in express/zod/pg, none installed in this offline sandbox. Same
// source-inspection approach already used by tests/v44_ci_cd_preparation.test.js
// for the same reason.

test('KYC_DOCUMENT_TYPES matches the current DB CHECK constraint exactly (migrations/034_v50_status_enum_integrity.sql)', () => {
  const kycRoute = read('src', 'routes', 'kyc.js');
  const match = kycRoute.match(/export const KYC_DOCUMENT_TYPES = \[([^\]]+)\]/);
  assert.ok(match, 'KYC_DOCUMENT_TYPES must still be exported from routes/kyc.js');
  const declared = match[1].split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean);

  const migration = read('migrations', '034_v50_status_enum_integrity.sql');
  const chk = migration.match(/kyc_document_type_check CHECK \(document_type IN \(([^)]+)\)/s);
  assert.ok(chk, 'the CHECK constraint must still exist in migration 034');
  const inDb = chk[1].split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean);

  assert.deepEqual([...declared].sort(), [...inDb].sort(), 'application-level enum and DB CHECK constraint must list the same document types');
});

test('POST /users/me/kyc (the route the frontend actually calls) validates document_type against KYC_DOCUMENT_TYPES before inserting', () => {
  const compat = read('src', 'routes', 'compatibility.js');
  const routeStart = compat.indexOf("r.post('/users/me/kyc'");
  assert.notEqual(routeStart, -1, "POST /users/me/kyc route must exist");
  const routeBody = compat.slice(routeStart, routeStart + 1200);

  assert.match(routeBody, /KYC_DOCUMENT_TYPES\.includes\(documentType\)/, 'must validate documentType against the enum');
  assert.match(routeBody, /throw new HttpError\(422,[^,]+,'KYC_DOCUMENT_TYPE_INVALID'\)/, 'must reject an invalid type with a specific 422 code, not rely on the DB alone');

  const validateIdx = routeBody.search(/KYC_DOCUMENT_TYPES\.includes/);
  const insertIdx = routeBody.search(/INSERT INTO kyc_documents/);
  assert.ok(validateIdx > -1 && insertIdx > -1 && validateIdx < insertIdx, 'validation must happen before the INSERT, not after');
});

test('compatibility.js imports KYC_DOCUMENT_TYPES from kyc.js (no duplicated, potentially-diverging list)', () => {
  const compat = read('src', 'routes', 'compatibility.js');
  assert.match(compat, /import\s*\{\s*KYC_DOCUMENT_TYPES\s*\}\s*from\s*'\.\/kyc\.js'/);
});
