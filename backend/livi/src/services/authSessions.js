import crypto from 'node:crypto';
import argon2 from 'argon2';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { HttpError } from '../utils/http.js';

export async function listSessions(userId, currentSessionId) {
  const { rows } = await pool.query(`
    SELECT id,jti,device_name,last_used_at,created_at,expires_at,ip_address,user_agent
    FROM auth_refresh_tokens
    WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>now()
    ORDER BY COALESCE(last_used_at,created_at) DESC`, [userId]);
  return rows.map(r => ({
    id:r.id, device_name:r.device_name || null, last_used_at:r.last_used_at,
    created_at:r.created_at, expires_at:r.expires_at, ip_address:r.ip_address,
    user_agent:r.user_agent, current: !!currentSessionId && r.id === currentSessionId
  }));
}

export async function revokeSession(userId, sessionId) {
  const result = await pool.query(`UPDATE auth_refresh_tokens SET revoked_at=now(),revoked_reason='user_revoke'
    WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL RETURNING id`, [sessionId,userId]);
  if (!result.rowCount) throw new HttpError(404,'Session introuvable','SESSION_NOT_FOUND');
  return { revoked:true };
}

export async function revokeAllSessions(userId, exceptJti=null, reason='logout_all') {
  const result = exceptJti
    ? await pool.query(`UPDATE auth_refresh_tokens SET revoked_at=now(),revoked_reason=$2 WHERE user_id=$1 AND revoked_at IS NULL AND jti<>$3`,[userId,reason,exceptJti])
    : await pool.query(`UPDATE auth_refresh_tokens SET revoked_at=now(),revoked_reason=$2 WHERE user_id=$1 AND revoked_at IS NULL`,[userId,reason]);
  return { revoked_count:result.rowCount };
}

export async function changePassword(userId, currentPassword, newPassword) {
  if (!currentPassword || !newPassword || newPassword.length < 10) throw new HttpError(422,'Mot de passe invalide','PASSWORD_INVALID');
  if (newPassword.length > 128) throw new HttpError(422,'Mot de passe trop long','PASSWORD_INVALID');
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id=$1 AND status=\'active\'',[userId]);
  const currentHash=rows[0]?.password_hash;
  const currentValid=!!currentHash && (currentHash.startsWith('$2a$') || currentHash.startsWith('$2b$') || currentHash.startsWith('$2y$') ? await bcrypt.compare(currentPassword,currentHash).catch(()=>false) : await argon2.verify(currentHash,currentPassword).catch(()=>false));
  if (!rows[0] || !currentHash || !currentValid) {
    throw new HttpError(401,'Mot de passe actuel incorrect','PASSWORD_INCORRECT');
  }
  const passwordHash = await bcrypt.hash(newPassword,12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET password_hash=$1,auth_version=auth_version+1,updated_at=now() WHERE id=$2',[passwordHash,userId]);
    await client.query(`UPDATE auth_refresh_tokens SET revoked_at=now(),revoked_reason='password_changed' WHERE user_id=$1 AND revoked_at IS NULL`,[userId]);
    await client.query('COMMIT');
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  return { changed:true, sessions_revoked:true };
}

export function sessionIdFromRequest(req){
  const raw=String(req.get('x-session-id')||'').trim();
  return raw && /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;
}
