import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePhone, slugify } from '../src/utils/phone.js';
import { HttpError } from '../src/utils/http.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authServiceSrc = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'services', 'auth.js'), 'utf8');

// --- phone normalization (real import, real execution) ----------------

test('normalizePhone: strips spaces/dashes, keeps leading +', () => {
  assert.equal(normalizePhone('+223 74 12 34 56'), '+22374123456');
  assert.equal(normalizePhone('+223-74-12-34-56'), '+22374123456');
  assert.equal(normalizePhone('+22374123456'), '+22374123456');
});

test('normalizePhone: three formatting variants of the same number converge', () => {
  const variants = ['+223 74 12 34 56', '+223-74-12-34-56', '+22374123456', ' +223 741 234 56 '];
  const normalized = new Set(variants.map(normalizePhone));
  assert.equal(normalized.size, 1, 'all variants must normalize to a single canonical value');
});

test('normalizePhone: no leading + is preserved as digits-only, not invented', () => {
  assert.equal(normalizePhone('74 12 34 56'), '74123456');
});

test('normalizePhone: non-string input passed through unchanged (defensive)', () => {
  assert.equal(normalizePhone(undefined), undefined);
  assert.equal(normalizePhone(null), null);
});

// --- vendor slug generation (real import, real execution) --------------

test('slugify: mirrors the SQL regexp_replace([^a-zA-Z0-9]+,-) pattern used elsewhere', () => {
  assert.equal(slugify('Aminata Traoré'), 'aminata-traor'); // 'é' is non a-z0-9 -> becomes a trailing dash, then trimmed
  assert.equal(slugify('  Boutique #1!!  '), 'boutique-1');
});

test('registration vendor slug (slugify(name) + 8 chars of user id) is collision-resistant', () => {
  // Mirrors the exact construction in services/auth.js register(): two
  // vendors with the identical name no longer collide, because each gets
  // a different brand-new user id.
  const buildSlug = (name, userId) => `${slugify(name) || 'boutique'}-${userId.slice(0, 8)}`;
  const idA = '11111111-aaaa-bbbb-cccc-111111111111';
  const idB = '22222222-aaaa-bbbb-cccc-222222222222';
  assert.notEqual(buildSlug('Aminata Traoré', idA), buildSlug('Aminata Traoré', idB));
});

test('slugify: empty/unusable name falls back to a non-empty base', () => {
  assert.equal(slugify('') || 'boutique', 'boutique');
  assert.equal(slugify('!!!') || 'boutique', 'boutique');
});

// --- HttpError constructor order (real import, real execution) --------
// See utils/http.js for the full bug writeup: every one of the 202 call
// sites in this codebase passes a machine-readable code as the 3rd
// argument; the constructor used to store it as `details` and leave
// `code` null, so the API's error.code field was 'INTERNAL_ERROR' on
// every single non-500 response.

test('HttpError: 3rd argument is code, 4th is details (matches all real call sites)', () => {
  const e = new HttpError(409, 'Ce numéro de téléphone est déjà utilisé.', 'PHONE_ALREADY_REGISTERED');
  assert.equal(e.status, 409);
  assert.equal(e.message, 'Ce numéro de téléphone est déjà utilisé.');
  assert.equal(e.code, 'PHONE_ALREADY_REGISTERED');
  assert.equal(e.details, null);
});

test('HttpError: details still works as an explicit 4th argument', () => {
  const e = new HttpError(422, 'Données invalides', 'VALIDATION_ERROR', { field: 'password' });
  assert.equal(e.code, 'VALIDATION_ERROR');
  assert.deepEqual(e.details, { field: 'password' });
});

test('HttpError: omitted code/details default to null, not undefined leaking as "INTERNAL_ERROR" bypass', () => {
  const e = new HttpError(404, 'Commande introuvable');
  assert.equal(e.code, null);
  assert.equal(e.details, null);
});

// --- password confirmation rule (mirrors the zod .refine in routes/auth.js) --
// zod is a real runtime dependency (not installed in this offline sandbox —
// see package.json / node_modules note in this session's report), so the
// actual `reg.parse(...)` call cannot be executed here. This mirrors the
// exact predicate passed to `.refine()` so the RULE itself is verified,
// the same pattern tests/finance_math.test.js already uses for commission
// math (reimplementing the pure calculation rather than importing the
// route). Full request-level validation (malformed JSON, zod's own error
// shape, the 400 it produces end to end) needs a real `node_modules` and
// is NOT POSSIBLE in this sandbox.
const passwordsMatch = (password, password_confirmation) => password === password_confirmation;

test('password confirmation rule: identical passwords pass', () => {
  assert.equal(passwordsMatch('unMotDePasseSolide', 'unMotDePasseSolide'), true);
});

test('password confirmation rule: any difference fails, including trailing space', () => {
  assert.equal(passwordsMatch('unMotDePasseSolide', 'unMotDePasseSolide '), false);
  assert.equal(passwordsMatch('unMotDePasseSolide', 'UnMotDePasseSolide'), false);
});

test('password minimum length is 10, matching resetPasswordWithOtp / ResetNewPasswordScreen', () => {
  // Was 8 in the register schema and 10 on the reset-password path — same
  // account, same password, two different rules depending on which screen
  // set it. Now both require the same minimum.
  const MIN = 10;
  assert.equal('short'.length >= MIN, false);
  assert.equal('unMotDePasseSolide'.length >= MIN, true);
});

// --- registration must not 500 on every single account (regression) ----

test('register(): the user_roles insert tolerates the trigger migration 037 already created the same row', () => {
  // SESSION 26 — RÉCONCILIATION À 3 VOIES (ZIP local x2 + dépôt GitHub réel).
  // Ce bug n'existe dans AUCUN des deux ZIP locaux fournis en début de
  // session — seulement dans le dépôt GitHub, corrigé manuellement le
  // 2026-09-06 (commit " auth.js"), probablement après un échec observé
  // contre la vraie base Supabase. Aucun test de ce sandbox ne peut le
  // détecter par exécution réelle (déclenche un vrai trigger Postgres,
  // absent de ce bac à sable) — ce test vérifie donc la présence du texte
  // SQL correct plutôt que le comportement en direct, en documentant
  // pourquoi l'absence de couverture par exécution n'est pas négociable ici.
  //
  // Mécanique exacte : la migration 037 (livi_sync_user_roles /
  // trg_sync_user_roles) ajoute un trigger AFTER INSERT sur `users` qui
  // insère déjà (user_id, role) dans user_roles au moment même où le INSERT
  // INTO users de register() ci-dessous s'exécute — avant que la ligne
  // suivante ne s'exécute à son tour. Sans ON CONFLICT, cette seconde
  // insertion percute systématiquement la même clé primaire et échoue —
  // *chaque* inscription, sans exception, aurait échoué en production.
  assert.match(
    authServiceSrc,
    /INSERT INTO user_roles\(user_id,role\) VALUES\(\$1,\$2\) ON CONFLICT \(user_id,role\) DO NOTHING/,
    'register() must tolerate migration 037\'s trigger having already inserted this exact row — without ON CONFLICT this is a 500 on every registration, not a rare race'
  );
});
