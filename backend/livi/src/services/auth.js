import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import bcrypt from 'bcryptjs';
import { pool, tx } from '../config/db.js';
import { env, allowStagingTestHelpers } from '../config/env.js';
import crypto from 'node:crypto';
import { HttpError } from '../utils/http.js';
import { normalizePhone, slugify } from '../utils/phone.js';
const hashToken=t=>crypto.createHash('sha256').update(t).digest('hex');
const otpHash=(phone,code)=>crypto.createHash('sha256').update(`${phone}:${code}`).digest('hex');
function access(user){ return jwt.sign({sub:user.id,role:user.role,phone:user.phone,av:Number(user.auth_version||1)},env.JWT_ACCESS_SECRET,{expiresIn:env.ACCESS_TOKEN_TTL,algorithm:'HS256'}); }
function refresh(user){ return jwt.sign({sub:user.id,type:'refresh',jti:crypto.randomUUID()},env.JWT_REFRESH_SECRET,{expiresIn:`${env.REFRESH_TOKEN_TTL_DAYS}d`,algorithm:'HS256'}); }
export async function issueSession(user,clientMeta={}){
  const rt=refresh(user); const decoded=jwt.decode(rt);
  const inserted=await pool.query('INSERT INTO auth_refresh_tokens(user_id,jti,token_hash,expires_at,ip_address,user_agent,device_name,last_used_at) VALUES($1,$2,$3,to_timestamp($4),$5,$6,$7,now()) RETURNING id',[user.id,decoded.jti,hashToken(rt),decoded.exp,clientMeta.ip||null,clientMeta.userAgent||null,clientMeta.deviceName||null]);
  const roleRows=(await pool.query('SELECT role,verified_at,kyc_level FROM user_roles WHERE user_id=$1 ORDER BY role',[user.id])).rows; return {token:access(user),refresh_token:rt,session_id:inserted.rows[0].id,user:{id:user.id,phone:user.phone,name:user.name,role:user.role,status:user.status,roles:roleRows.map(r=>r.role),role_details:roleRows}};
}

export async function sendOtp(phone,purpose='password_reset'){
  // V45: gated on allowStagingTestHelpers (true for development/test
  // always, or for production only when the operator explicitly opted in
  // via ALLOW_STAGING_TEST_HELPERS) rather than a bare NODE_ENV==='production'
  // check — see src/config/env.js for the full reasoning.
  const code=allowStagingTestHelpers?env.DEV_OTP:String(crypto.randomInt(100000,1000000));
  await pool.query('UPDATE auth_otp_challenges SET consumed_at=now() WHERE phone=$1 AND purpose=$2 AND consumed_at IS NULL',[phone,purpose]);
  await pool.query("INSERT INTO auth_otp_challenges(phone,code_hash,purpose,expires_at) VALUES($1,$2,$3,now()+interval '5 minutes')",[phone,otpHash(phone,code),purpose]);
  console.log(`[LIVI OTP] ${purpose} ${phone}: ${allowStagingTestHelpers?code:'sent via provider'}`);
  return {sent:true,expires_in:300};
}
// V-AUDIT (OTP/SMS removal from account opening): verifyOtp() used to serve
// both login and registration — looking up-or-creating a user by phone and
// issuing a session the moment a 'login'/'register'-purpose OTP was
// verified, with NO password ever set on the created account. Now that
// register() (below) and login() both require a password directly, this
// function has no legitimate caller left; leaving it reachable would be a
// backdoor that creates full sessions for passwordless accounts. Removed
// together with its route (POST /auth/otp/verify, routes/auth.js).
// sendOtp() and resetPasswordWithOtp() are untouched — the "forgot
// password" flow is a separate, legitimate use of the same OTP/SMS
// channel and was explicitly out of scope for this removal.

// V54 (frontend ForgotPasswordScreen -> VerifyOtp{mode:'password-reset'}
// already sent a `mode` param nobody read, and there was no way to ever set
// a new password: changePassword() below requires knowing the CURRENT
// password, which is exactly what a "forgot password" user doesn't have).
// This mirrors verifyOtp()'s own challenge lookup (same table, same hashing,
// scoped to purpose='password_reset' so it can never be satisfied by a
// login/register OTP) but does NOT call issueSession — resetting a password
// on whatever device requested the code should not silently open a session
// there. Existing sessions elsewhere are revoked, same as changePassword().
export async function resetPasswordWithOtp(phone,code,newPassword){
  if(!newPassword||newPassword.length<10) throw new HttpError(422,'Mot de passe invalide (10 caractères minimum)','PASSWORD_INVALID');
  if(newPassword.length>128) throw new HttpError(422,'Mot de passe trop long','PASSWORD_INVALID');
  const {rows}=await pool.query("SELECT id FROM auth_otp_challenges WHERE phone=$1 AND purpose='password_reset' AND consumed_at IS NULL AND expires_at>now() AND attempts<max_attempts ORDER BY created_at DESC LIMIT 1",[phone]);
  if(!rows[0]) throw new HttpError(401,'Code expiré ou invalide');
  const hash=otpHash(phone,code);
  const c=await pool.query('UPDATE auth_otp_challenges SET attempts=attempts+1 WHERE id=$1 AND code_hash=$2 RETURNING id',[rows[0].id,hash]);
  if(!c.rowCount) throw new HttpError(401,'Code invalide');
  await pool.query('UPDATE auth_otp_challenges SET consumed_at=now() WHERE id=$1',[rows[0].id]);
  const u=(await pool.query("SELECT id FROM users WHERE phone=$1 AND status='active'",[phone])).rows[0];
  if(!u) throw new HttpError(404,'Compte introuvable');
  const passwordHash=await bcrypt.hash(newPassword,12);
  await pool.query('UPDATE users SET password_hash=$1,auth_version=auth_version+1,updated_at=now() WHERE id=$2',[passwordHash,u.id]);
  await pool.query("UPDATE auth_refresh_tokens SET revoked_at=now(),revoked_reason='password_reset' WHERE user_id=$1 AND revoked_at IS NULL",[u.id]);
  return {reset:true};
}

// V-AUDIT (OTP/SMS removal from account opening — decision définitive):
// registration is now name + phone + password (+ password_confirmation,
// checked by the zod schema in routes/auth.js before this is ever called)
// with the account created and the session opened immediately. No OTP, no
// SMS, no verification step. Rewritten for three confirmed bugs on top of
// that change:
//   1. `password` was optional and unhashed-to-null when absent — every
//      account created this way had password_hash=NULL and could never
//      log in again (login() requires a password). Now required.
//   2. User + wallet + user_roles + vendor/transporter were five
//      unguarded sequential pool.query calls with no transaction — a
//      failure on any one (e.g. the vendor insert) left a real,
//      logged-in user with a missing wallet or role. Now one transaction
//      via tx(): all-or-nothing.
//   3. The vendor slug was `ON CONFLICT DO NOTHING` on a value derived
//      only from the person's name — two vendors named e.g. "Aminata
//      Traoré" collide on the same slug, and DO NOTHING silently skipped
//      the vendor row while the user/role/wallet already committed: a
//      "vendor" account with no vendors row, broken in every vendor
//      screen. The slug is now suffixed with 8 chars of the new user's
//      own id (collision-resistant by construction — this is a
//      placeholder shop identity anyway; SellerOnboardingScreen lets the
//      vendor set a real shop_name/slug afterwards), and a genuine
//      conflict now fails the whole transaction with an explicit 409
//      instead of silently succeeding half-done.
export async function register({phone,name,first_name,last_name,password,role='client'},meta){
  const normalizedPhone = normalizePhone(phone);
  name = name || [first_name,last_name].filter(Boolean).join(' ') || normalizedPhone;
  if(!['client','vendor','transporter'].includes(role)) throw new HttpError(400,'Rôle non autorisé','ROLE_INVALID');
  if(!password) throw new HttpError(422,'Mot de passe requis','PASSWORD_REQUIRED');

  // Pre-check outside the write transaction so the common case (number
  // genuinely available) fails fast with a clean, specific error instead
  // of paying for a transaction just to hit the same conflict below. The
  // UNIQUE constraint on users.phone plus the catch block after tx() are
  // what actually make this race-safe for two truly concurrent
  // registrations of the same number — this check is an optimization,
  // not the safety net.
  const exists=await pool.query('SELECT id FROM users WHERE phone=$1',[normalizedPhone]);
  if(exists.rowCount) throw new HttpError(409,'Ce numéro de téléphone est déjà utilisé.','PHONE_ALREADY_REGISTERED');

  const passwordHash=await bcrypt.hash(password,12);

  try {
    const user = await tx(async c => {
      const {rows}=await c.query('INSERT INTO users(phone,name,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,phone,name,role,status',[normalizedPhone,name,passwordHash,role]);
      const u=rows[0];
      await c.query("INSERT INTO wallets(user_id,currency) VALUES($1,'XOF')",[u.id]);
      // V-FIX (porté depuis un correctif appliqué directement sur GitHub le
      // 2026-09-06, découvert lors de la réconciliation à 3 voies
      // Session 26 — absent des deux ZIP locaux, donc absent de toute
      // exécution de test de ce sandbox, qui ne peut pas déclencher un
      // trigger Postgres réel) : la migration 037 (trg_sync_user_roles)
      // ajoute un trigger AFTER INSERT sur users qui insère déjà cette même
      // ligne (user_id,role) au moment même où l'INSERT users ci-dessus
      // s'exécute, avant que cette instruction ne s'exécute. L'ancien
      // commentaire ("première ligne de rôle d'un nouvel utilisateur") date
      // d'avant ce trigger et n'est plus vrai — sans ON CONFLICT, ceci
      // percutait systématiquement la clé primaire (user_id,role) et
      // renvoyait une 500 sur CHAQUE inscription, sans exception. ON
      // CONFLICT DO NOTHING reflète exactement la clause du trigger lui-même
      // ; un couple user_id+role réellement nouveau continue de fonctionner
      // normalement.
      await c.query('INSERT INTO user_roles(user_id,role) VALUES($1,$2) ON CONFLICT (user_id,role) DO NOTHING',[u.id,role]);
      if(role==='vendor'){
        const slug = `${slugify(name) || 'boutique'}-${u.id.slice(0,8)}`;
        try {
          await c.query('INSERT INTO vendors(id,shop_name,slug) VALUES($1,$2,$3)',[u.id,name,slug]);
        } catch(e) {
          if(e.code==='23505') throw new HttpError(409,'Une boutique existe déjà pour ce compte.','VENDOR_ALREADY_EXISTS');
          throw e;
        }
      }
      if(role==='transporter') await c.query('INSERT INTO transporters(id) VALUES($1)',[u.id]);
      return u;
    });
    return issueSession(user,meta);
  } catch(e) {
    if(e.code==='23505' && /phone/i.test(e.constraint||'')) throw new HttpError(409,'Ce numéro de téléphone est déjà utilisé.','PHONE_ALREADY_REGISTERED');
    throw e;
  }
}
export async function login({phone,password},meta){
  const {rows}=await pool.query('SELECT id,phone,name,role,status,password_hash,auth_version,failed_login_attempts,locked_until FROM users WHERE phone=$1',[phone]);
  const u=rows[0];
  if(!u || u.status!=='active' || (u.locked_until && new Date(u.locked_until).getTime()>Date.now())) throw new HttpError(401,'Identifiants invalides ou compte temporairement verrouillé','AUTH_LOCKED');
  const valid=!!u.password_hash && (u.password_hash.startsWith('$2a$') || u.password_hash.startsWith('$2b$') || u.password_hash.startsWith('$2y$') ? await bcrypt.compare(password,u.password_hash).catch(()=>false) : await argon2.verify(u.password_hash,password).catch(()=>false));
  if(!valid){
    const attempts=Number(u.failed_login_attempts||0)+1;
    if(attempts>=5){
      await pool.query("UPDATE users SET failed_login_attempts=0,locked_until=now()+interval '15 minutes',updated_at=now() WHERE id=$1",[u.id]);
    } else {
      await pool.query('UPDATE users SET failed_login_attempts=$2,updated_at=now() WHERE id=$1',[u.id,attempts]);
    }
    throw new HttpError(401,'Identifiants invalides','AUTH_INVALID');
  }
  await pool.query('UPDATE users SET failed_login_attempts=0,locked_until=NULL,last_login_at=now(),updated_at=now() WHERE id=$1',[u.id]);
  return issueSession(u,meta);
}
export async function rotateRefresh(token,meta){
  let p; try { p=jwt.verify(token,env.JWT_REFRESH_SECRET,{algorithms:['HS256']}); } catch { throw new HttpError(401,'Refresh token invalide'); }
  const hash=hashToken(token); const {rows}=await pool.query('SELECT u.id,u.phone,u.name,u.role,u.status,u.auth_version FROM auth_refresh_tokens r JOIN users u ON u.id=r.user_id WHERE r.jti=$1 AND r.token_hash=$2 AND r.revoked_at IS NULL AND r.expires_at>now()',[p.jti,hash]);
  if(!rows[0]) throw new HttpError(401,'Refresh token déjà utilisé ou expiré');
  await pool.query("UPDATE auth_refresh_tokens SET revoked_at=now(),revoked_reason='rotated',last_used_at=now() WHERE jti=$1",[p.jti]);
  return issueSession(rows[0],meta);
}
export async function logout(token){ if(!token)return; try{const p=jwt.verify(token,env.JWT_REFRESH_SECRET,{ignoreExpiration:true}); await pool.query("UPDATE auth_refresh_tokens SET revoked_at=now(),revoked_reason='logout' WHERE jti=$1",[p.jti]);}catch{} }
