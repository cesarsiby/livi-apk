const SENSITIVE_KEYS = new Set([
  'password','password_hash','token','access_token','refresh_token','token_hash',
  'secret','secret_hash','code','code_hash','otp','otp_code','otp_hash',
  'pin','pin_hash','qr_payload','qr_secret','file_key','authorization',
  'cookie','set-cookie','rawbody','raw_body'
]);

// V42 — observability audit finding: key matching below previously only
// lowercased and collapsed hyphens/spaces to underscores before matching
// against SENSITIVE_KEYS. That reliably matches raw Postgres row objects
// (snake_case columns: `file_key`, `qr_payload`, `pin_hash`, ...) but NOT
// application-constructed JS objects using camelCase — and camelCase is
// exactly how these same field names appear in real code:
// src/services/deliveryProof.js literally returns objects shaped like
// `{ pin, token, qrPayload, ... }`. A camelCase `qrPayload`/`fileKey`/
// `otpCode`/`pinHash` key would normalize to `qrpayload`/`filekey`/
// `otpcode`/`pinhash` — none of which match any SENSITIVE_KEYS entry, and
// none of which are caught by the substring fallback either (that list
// only covers password/token/secret, not otp/pin/qr/file). No current
// call site of redactSensitive() happens to pass such an object today
// (verified by reading every audit()/console.error call site), but the
// gap is a latent landmine: the natural next call — passing a service's
// camelCase return value into audit() or an error log — would silently
// bypass redaction. Fixed by converting camelCase to snake_case before
// matching, so key matching is robust regardless of naming convention.
function toSnakeCase(key){
  return key
    .replace(/([a-z0-9])([A-Z])/g,'$1_$2')
    .toLowerCase()
    .replace(/[-\s]/g,'_');
}

// V42 correction (caught before shipping, kept here as a documented
// near-miss): an earlier draft of this fix widened the substring fallback
// to include bare 'pin'/'qr_'/'file_key' tokens for extra defense-in-depth.
// That was wrong and dangerous: naive substring matching on the whole
// normalized key means 'shipping_fee'.includes('pin') is TRUE ("sh-i-pp-
// i-n-g" contains "pin") — it would have silently redacted the legitimate,
// mission-critical `shipping_fee` / `shipping_release` fields out of every
// audit log and error log, breaking the traceability requirement the audit
// trail exists for. The camelCase-to-snake_case normalization above
// already fixes the actual gap (qrPayload -> qr_payload, fileKey ->
// file_key, otpCode -> otp_code, pinHash -> pin_hash all now match
// SENSITIVE_KEYS by exact key, not substring), so the substring fallback
// is left exactly as it was — only password/token/secret, which are safe
// broad substrings precisely because no legitimate LIVI field name
// contains any of those three words as a false-positive.
export function redactSensitive(value, depth=0){
  if(depth>8) return '[TRUNCATED]';
  if(value===null || value===undefined) return value;
  if(typeof value==='string') return value.length>4000 ? `${value.slice(0,4000)}…[TRUNCATED]` : value;
  if(typeof value==='number' || typeof value==='boolean') return value;
  if(Buffer.isBuffer(value)) return '[BUFFER]';
  if(Array.isArray(value)) return value.map(v=>redactSensitive(v,depth+1));
  if(typeof value==='object'){
    const out={};
    for(const [k,v] of Object.entries(value)){
      const normalized=toSnakeCase(k);
      if(SENSITIVE_KEYS.has(normalized) || normalized.includes('password') || normalized.includes('token') || normalized.includes('secret')) out[k]='[REDACTED]';
      else out[k]=redactSensitive(v,depth+1);
    }
    return out;
  }
  return String(value);
}
