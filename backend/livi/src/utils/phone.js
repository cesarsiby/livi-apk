// V-AUDIT (registration/authentification): no phone normalization existed
// anywhere in the codebase prior to this. `users.phone` is `citext`
// (case-insensitive) but citext does not collapse whitespace or
// punctuation — "+223 74 12 34 56", "+22374123456" and
// "+223-74-12-34-56" were three distinct values to both the uniqueness
// check in register() and the lookup in login(). A person could
// register once with spaces and be told on a later attempt (typed
// without spaces) that the number is available, or fail to log in with
// a phone typed slightly differently than at signup.
//
// This keeps only a leading '+' (if present) and digits, so any
// formatting variant of the same number normalizes to one canonical
// value. It deliberately does not inject a default country code: LIVI's
// placeholder numbers are Mali (+223) but nothing in this codebase
// restricts registration to a single country, and guessing one here
// would silently corrupt numbers from anywhere else.
export function normalizePhone(raw) {
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  const hasLeadingPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^0-9]/g, '');
  return (hasLeadingPlus ? '+' : '') + digits;
}

// Mirrors the slugification already used inline via SQL elsewhere in this
// codebase (`lower(regexp_replace($2,'[^a-zA-Z0-9]+','-','g'))`, see
// routes/users.js and routes/compatibility.js) so slugs generated in JS
// and slugs generated in SQL follow the same rule. Additionally trims
// leading/trailing dashes, which the SQL version does not — a harmless
// cosmetic improvement, not a behavior this depends on for correctness.
export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
