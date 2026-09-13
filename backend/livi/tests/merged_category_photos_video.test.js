import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

// V-AUDIT: LIVI_Correctifs_Categorie_Photos_Video.zip arrived independently
// (produced against the post-Session-8 codebase, before this audit's
// Session 9-13 fixes existed) and was merged in by hand rather than
// overwriting files wholesale, since it touches the same two backend files
// (routes/compatibility.js, routes/products.js) that Sessions 9-13 already
// fixed. These tests check both halves of that merge: the new
// category/photo/video functionality actually landed, AND the earlier
// session fixes to the same files were not clobbered in the process.

test('merge did not clobber Session 9-13 fixes to compatibility.js', () => {
  const compat = read('src', 'routes', 'compatibility.js');
  assert.match(compat, /KYC_DOCUMENT_TYPES\.includes\(documentType\)/, 'Session 13: KYC document_type validation must survive');
  assert.match(compat, /PRODUCT_SLUG_ALREADY_EXISTS/, 'Session 12: product slug conflict handling must survive');
  assert.doesNotMatch(compat, /req\.id\b/, 'Session 13: req.id must not have been reintroduced by the merge');
  assert.match(compat, /const shipmentId = await tx\(async c => \{/, 'Session 11: transporter/location transaction must survive');
});

test('GET /categories exists and is public (no requireAuth) — categories are a browsable taxonomy, not vendor-private data', () => {
  const compat = read('src', 'routes', 'compatibility.js');
  const line = compat.split('\n').find(l => l.includes("r.get('/categories'"));
  assert.ok(line, 'GET /categories must exist');
  assert.doesNotMatch(line, /requireAuth/);
  assert.match(line, /FROM categories ORDER BY name/);
});

test('POST/PUT /vendor/products accept category_id alongside the existing slug-conflict handling', () => {
  const compat = read('src', 'routes', 'compatibility.js');
  const postIdx = compat.indexOf("r.post('/vendor/products'");
  const postBody = compat.slice(postIdx, postIdx + 2200);
  assert.match(postBody, /category_id:z\.string\(\)\.uuid\(\)\.optional\(\)/, 'zod schema must accept category_id');
  assert.match(postBody, /INSERT INTO products\(vendor_id,name,slug,description,price_xof,stock,status,category_id\)/);
  assert.match(postBody, /PRODUCT_SLUG_ALREADY_EXISTS/, 'the Session 12 conflict handling must still wrap this exact INSERT');

  const putIdx = compat.indexOf("r.put('/vendor/products/:id'");
  const putBody = compat.slice(putIdx, putIdx + 1900); // SESSION 26: widened from 900 — the added Zod-validation comment (§18-19) pushed category_id=coalesce further into the route than this window originally assumed
  assert.match(putBody, /category_id=coalesce\(\$6,category_id\)/);
  assert.match(putBody, /PRODUCT_MEDIA_MINIMUM/, 'the pre-existing 3-photo-minimum rule must still be present');
});

test('vendor video upload stores a servable basename, not the server\'s own filesystem path', () => {
  const compat = read('src', 'routes', 'compatibility.js');
  const idx = compat.indexOf("r.post('/vendor/videos'");
  const body = compat.slice(idx, idx + 900);
  assert.match(body, /const fileKey=path\.basename\(req\.file\.path\)/, 'must strip the upload dir, matching how product_media already does it');
  assert.doesNotMatch(body, /file_key\) VALUES\(\$1,\$2,\$3,req\.file\.path\)/, 'must not store the raw server path directly (the bug being fixed)');
});

test('vendor video upload links the video into social_posts in the same transaction (so it actually reaches the feed)', () => {
  const compat = read('src', 'routes', 'compatibility.js');
  const idx = compat.indexOf("r.post('/vendor/videos'");
  const body = compat.slice(idx, idx + 1400);
  assert.match(body, /await tx\(async c=>\{/);
  assert.match(body, /INSERT INTO social_posts\(author_id,kind,media_url,caption\) VALUES\(\$1,'video',\$2,\$3\)/);
});

test('GET /videos/:videoId exists and actually streams the file (previously missing entirely)', () => {
  const compat = read('src', 'routes', 'compatibility.js');
  assert.match(compat, /r\.get\('\/videos\/:videoId', asyncHandler\(async\(req,res\)=>\{const row=/);
  const idx = compat.indexOf("r.get('/videos/:videoId'");
  const body = compat.slice(idx, idx + 400);
  assert.match(body, /res\.sendFile\(path\.resolve\(process\.cwd\(\),'uploads',path\.basename\(row\.file_key\)\)\)/, 'must use path.basename on the stored key before resolving (basic path-traversal guard)');
});

test('deleting a video also removes its social_posts row (no orphaned feed entry pointing at a deleted video)', () => {
  const compat = read('src', 'routes', 'compatibility.js');
  const idx = compat.indexOf("r.delete('/vendor/videos/:id'");
  const body = compat.slice(idx, idx + 700);
  assert.match(body, /DELETE FROM social_posts WHERE author_id=\$1 AND kind='video' AND media_url=\$2/);
});

test('products.js catalogue/detail responses include category_id and images (product_media join)', () => {
  const products = read('src', 'routes', 'products.js');
  const listIdx = products.indexOf("r.get('/',asyncHandler");
  const listBody = products.slice(listIdx, listIdx + 700);
  assert.match(listBody, /p\.category_id/);
  assert.match(listBody, /FROM product_media pm WHERE pm\.product_id=p\.id AND pm\.kind='image'/);

  const detailIdx = products.indexOf("r.get('/:id',asyncHandler");
  const detailBody = products.slice(detailIdx, detailIdx + 700);
  assert.match(detailBody, /p\.category_id/);
  assert.match(detailBody, /product_media/);
});

test('the image URLs products.js builds point at the media route that actually exists and serves files', () => {
  const products = read('src', 'routes', 'products.js');
  assert.match(products, /'\/api\/v1\/products\/'\|\|p\.id\|\|'\/media\/'\|\|pm\.id/);
  const compat = read('src', 'routes', 'compatibility.js');
  assert.match(compat, /r\.get\('\/products\/:productId\/media\/:mediaId'/, 'the route these URLs point to must actually exist');
});

test('migration renumbered from the incoming 040 to 041 to avoid colliding with 040_v55_commission_snapshot.sql (Session 10)', () => {
  assert.equal(fs.existsSync(path.join(root, 'migrations', '040_v54_seed_categories.sql')), false, 'the original number must not also exist (no duplicate/orphan copy)');
  const migration = read('migrations', '041_v54_seed_categories.sql');
  assert.match(migration, /INSERT INTO categories\(name,slug\) VALUES/);
  assert.match(migration, /ON CONFLICT \(slug\) DO NOTHING/, 'must be idempotent/safe to re-run');
  assert.doesNotMatch(migration, /^\s*BEGIN\s*;\s*$/m, 'must not reintroduce the internal BEGIN/COMMIT bug fixed in Session 9');
  assert.doesNotMatch(migration, /^\s*COMMIT\s*;\s*$/m);
});
