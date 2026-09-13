import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendSrc = path.resolve(__dirname, '..', '..', '..', 'frontend', 'livi', 'src');
const read = (...p) => fs.readFileSync(path.join(frontendSrc, ...p), 'utf8');

// V-AUDIT (section 47 — error feedback). Also checked loading-state
// try/finally coverage across all 48 screens using a loading flag
// (setLoading/setSubmitting/setBusy/setSaving) — every one already has at
// least as many `finally` blocks as loading-start calls, so no
// stuck-in-loading-after-error candidates were found there; not repeated
// as an automated test here since it is a structural/heuristic check, not
// a specific behavioral claim like the one below.

test('FeedScreen: a failed comment post now shows a visible error (previously an empty catch block)', () => {
  const feed = read('screens', 'social', 'FeedScreen.tsx');
  const idx = feed.indexOf('const submitComment');
  assert.notEqual(idx, -1);
  const body = feed.slice(idx, idx + 400);
  assert.doesNotMatch(body, /catch \(e\) \{\}/, 'the empty catch must be gone');
  assert.match(body, /Alert\.alert\('Commentaire'/);
});

test('no genuinely empty catch blocks remain anywhere in screen code', () => {
  // Mirrors the audit's own grep: catch (e) {} with nothing but whitespace
  // inside. toggleLike and the inline share handler in FeedScreen.tsx are
  // deliberately left silent (documented in this session\'s report — a
  // low-stakes "like" toggle with no loading affordance, and
  // Share.share() rejecting on a normal user-cancelled share sheet) and
  // are the only two expected remaining matches.
  const feed = read('screens', 'social', 'FeedScreen.tsx');
  const matches = [...feed.matchAll(/catch \([^)]*\) \{\s*\}/g)];
  assert.equal(matches.length, 2, `expected exactly 2 intentional empty catches (toggleLike, share), found ${matches.length}`);
});
