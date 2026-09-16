import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const frontendSrc = path.resolve(__dirname, '..', '..', '..', 'frontend', 'livi', 'src');
const readBackend = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const readFrontend = (...p) => fs.readFileSync(path.join(frontendSrc, ...p), 'utf8');

// SESSION 26 — trouvé en étendant la vérification des contrats de payload
// à tous les formulaires de l'app (§19/§49 du prompt maître), pas
// seulement ceux déjà tracés. POST /users/me/addresses exige
// `country: z.string().length(2)` — le formulaire d'ajout d'adresse
// envoyait toujours 'Mali' (4 caractères) en valeur par défaut, jamais
// corrigée par l'utilisateur puisque ce champ n'est pas affiché dans le
// formulaire. Conséquence : AUCUNE création d'adresse ne pouvait jamais
// réussir, dans toute l'app — et sans adresse, CheckoutScreen désactive
// structurellement le bouton de paiement (voir addendum 2,
// RAPPORT_UXUI_SESSION21_STRATEGIE_ET_IMPLEMENTATION.md, sur le même bug
// de fond découvert ailleurs) : un nouvel acheteur n'aurait jamais pu
// finaliser un premier achat.

test('AddressesScreen sends a 2-letter country code, matching the backend\'s z.string().length(2)', () => {
  const backend = readBackend('src', 'routes', 'compatibility.js');
  const idx = backend.indexOf("r.post('/users/me/addresses'");
  assert.notEqual(idx, -1);
  const body = backend.slice(idx, idx + 400);
  assert.match(body, /country:z\.string\(\)\.length\(2\)\.default\('ML'\)/, 'confirms the exact constraint this test guards against — 2 characters, defaulting to ML');

  const screen = readFrontend('screens', 'buyer', 'AddressesScreen.tsx');
  const countryDefaults = [...screen.matchAll(/country:\s*'([^']*)'/g)].map(m => m[1]);
  assert.ok(countryDefaults.length >= 2, `expected at least 2 default-form country values, found ${countryDefaults.length} — the screen may have been restructured`);
  for (const value of countryDefaults) {
    assert.equal(value.length, 2, `country default "${value}" is ${value.length} characters, but the backend requires exactly 2 — every address creation would fail Zod validation`);
  }
});
