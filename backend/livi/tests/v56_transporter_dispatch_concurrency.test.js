import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

// SESSION 26 — §28 du prompt maître (dispatch transporteur, concurrence).
// findNextCandidate() (services/missionDispatch.js) filtre par SELECT, pas
// FOR UPDATE, les transporteurs déjà en mission active. Deux dispatches
// concurrents pour deux livraisons différentes peuvent donc tous les deux
// offrir la même livraison... au même transporteur libre, avant qu'aucun
// des deux n'ait rien écrit. Comme le prompt maître le demande
// explicitement pour ce cas ("protection transactionnelle et/ou contrainte
// DB appropriée"), la garantie retenue est une contrainte DB — plus forte
// qu'une vérification applicative, qui reste elle-même sujette à sa propre
// course. Aucune base réelle dans ce sandbox pour exécuter une vraie
// course concurrente ; ces tests vérifient la présence de la contrainte et
// sa gestion applicative par lecture de source.

test('migration 042 declares a partial unique index enforcing at most one active mission per transporter', () => {
  const migration = read('migrations', '042_v56_transporter_single_active_mission.sql');
  assert.match(migration, /CREATE UNIQUE INDEX shipments_transporter_single_active_mission/);
  assert.match(migration, /ON shipments\(transporter_id\)/);
  assert.match(migration, /WHERE status IN \('assigned','picked_up','in_transit','arrived'\)/, 'must match the exact status list findNextCandidate() already treats as \"has an active mission\" in services/missionDispatch.js');
});

test('the active-mission status list is identical between the dispatch filter and the new DB constraint (drift here would silently reopen the race for whichever status is missing from one side)', () => {
  const dispatch = read('src', 'services', 'missionDispatch.js');
  const migration = read('migrations', '042_v56_transporter_single_active_mission.sql');
  const dispatchList = dispatch.match(/s\.status IN \('([a-z_',]+)'\)/)?.[1];
  const migrationList = migration.match(/WHERE status IN \('([a-z_',]+)'\)/)?.[1];
  assert.ok(dispatchList, 'could not find the status list in missionDispatch.js — regex may be stale');
  assert.equal(migrationList, dispatchList);
});

test('POST /transporter/missions/:id/accept converts the new constraint violation into a clean 409, not a raw 500', () => {
  const compat = read('src', 'routes', 'compatibility.js');
  const idx = compat.indexOf("r.post('/transporter/missions/:id/accept'");
  assert.notEqual(idx, -1);
  const body = compat.slice(idx, idx + 1600);
  assert.match(body, /catch\(e\)\{/);
  assert.match(body, /if\(e\?\.code==='23505'\) throw new HttpError\(409,'[^']+','TRANSPORTER_ALREADY_HAS_ACTIVE_MISSION'\);/);
});

test('§29: POST /transporter/missions/:id/arrive now updates status and inserts its shipment_event in one transaction, not two bare pool.query() calls', () => {
  // Same anti-pattern the code's own comment on /transporter/location
  // (a few lines further down in this file) describes and had already
  // fixed there — this sibling route emitting the 'arrived' milestone
  // event had not been caught at the time. A crash between the two
  // separate pool.query() calls used to leave status='arrived' with no
  // corresponding audit trail row, and no way to detect that after the fact.
  const compat = read('src', 'routes', 'compatibility.js');
  const idx = compat.indexOf("r.post('/transporter/missions/:id/arrive'");
  assert.notEqual(idx, -1);
  const body = compat.slice(idx, idx + 1400);
  assert.match(body, /await tx\(async c=>\{/);
  assert.match(body, /c\.query\("UPDATE shipments SET status='arrived'/);
  assert.match(body, /c\.query\('INSERT INTO shipment_events/);
});
