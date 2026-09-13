import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  // V41: this was hardcoded to 12, silently ignoring env.AUTH_RATE_LIMIT
  // even though src/config/env.js validates that variable specifically
  // for this purpose (z.coerce.number()...default(12)) — an operator
  // setting AUTH_RATE_LIMIT in production to tighten (or loosen) the
  // login/register/refresh rate limit would have had zero effect. Now
  // actually reads the configured value; default behavior (12/15min) is
  // unchanged since env.js's own default is also 12.
  limit: env.AUTH_RATE_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: { success:false, error:{ code:'AUTH_RATE_LIMIT', message:'Trop de tentatives. Réessayez plus tard.' } }
});

export const otpLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: req => `${req.ip}:${String(req.body?.phone || '').trim().toLowerCase()}`,
  message: { success:false, error:{ code:'OTP_RATE_LIMIT', message:'Trop de demandes OTP. Réessayez plus tard.' } }
});

export const proofLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: req => `${req.ip}:${req.user?.sub || 'anonymous'}`,
  message: { success:false, error:{ code:'PROOF_RATE_LIMIT', message:'Trop de tentatives de validation. Réessayez plus tard.' } }
});

export function noStoreSensitive(req,res,next){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Pragma','no-cache');
  res.setHeader('X-Content-Type-Options','nosniff');
  next();
}

export function safeCompareHex(a,b){
  try {
    const left=Buffer.from(String(a),'hex');
    const right=Buffer.from(String(b),'hex');
    return left.length===right.length && left.length>0 && crypto.timingSafeEqual(left,right);
  } catch { return false; }
}

export function assertSafeFileKey(value){
  const key=String(value||'');
  if(key.length<5 || key.length>500 || key.includes('..') || key.includes('/') || key.includes('\\') || key.startsWith('.') || /[\0\r\n]/.test(key)) {
    const err=new Error('Clé de fichier invalide'); err.status=422; err.code='INVALID_FILE_KEY'; throw err;
  }
  return key;
}
