import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// SESSION 26 (suite) — §34 du prompt maître. Découvert en comparant ce
// dépôt à une ré-upload manuelle faite directement sur GitHub (hors de ce
// sandbox) : la contrainte DB kyc_document_type_check
// (migrations/022_v25_security_hardening.sql) n'autorisait que 5 types
// ('cni','passport','business_registration','tax_document','other') alors
// que KYC_DOCUMENT_TYPES (routes/kyc.js), utilisé par la vraie route de
// soumission (compatibility.js), en autorise 10 — 'permis', 'assurance',
// 'identity', 'business', 'address' passaient donc Zod pour échouer
// ensuite sur une contrainte DB générique (23514), avec un message
// technique au lieu de l'erreur claire que Zod aurait donnée. C'est
// l'inverse du risque nommé au §34 ("ne pas dépendre uniquement d'une
// contrainte DB") : ici c'était la validation applicative qui était trop
// permissive par rapport à ce que la DB acceptait réellement. Migration
// corrigée pour inclure les 10 types ; ce test compare littéralement les
// deux listes pour qu'un futur ajout d'un côté sans l'autre soit détecté
// avant d'atteindre la production, plutôt que découvert au hasard d'une
// comparaison manuelle comme cette fois-ci.

test('KYC_DOCUMENT_TYPES (application) and kyc_document_type_check (DB) allow exactly the same set of values', () => {
  const kycRoute = fs.readFileSync(path.join(root, 'src', 'routes', 'kyc.js'), 'utf8');
  const appMatch = kycRoute.match(/KYC_DOCUMENT_TYPES = \[([^\]]+)\]/);
  assert.ok(appMatch, 'could not find KYC_DOCUMENT_TYPES in routes/kyc.js — regex may be stale');
  const appTypes = appMatch[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).sort();

  const migration = fs.readFileSync(path.join(root, 'migrations', '022_v25_security_hardening.sql'), 'utf8');
  const dbMatch = migration.match(/kyc_document_type_check CHECK \(document_type IN \(([^)]+)\)\)/);
  assert.ok(dbMatch, 'could not find kyc_document_type_check in migrations/022_v25_security_hardening.sql — regex may be stale');
  const dbTypes = dbMatch[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).sort();

  assert.deepEqual(dbTypes, appTypes, `app allows [${appTypes}] but the DB constraint only allows [${dbTypes}] (or vice versa) — a submission with a type present on only one side will either be silently impossible or fail with a raw DB error instead of a clean Zod 422`);
});

test('the file_key traversal guard still includes the null-byte check (regression: a manual re-upload of this migration outside this session had silently dropped it)', () => {
  const migration = fs.readFileSync(path.join(root, 'migrations', '022_v25_security_hardening.sql'), 'utf8');
  assert.match(migration, /position\(chr\(0\) in file_key\)=0/);
});
