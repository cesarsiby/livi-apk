import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { pool } from '../config/db.js';
import { HttpError } from '../utils/http.js';

export function requireAuth(req,res,next){
  const h=req.get('authorization')||'';
  const token=h.startsWith('Bearer ')?h.slice(7):null;
  if(!token) return next(new HttpError(401,'Authentification requise','AUTH_REQUIRED'));
  try {
    const claims=jwt.verify(token,env.JWT_ACCESS_SECRET,{algorithms:['HS256']});
    if(claims.type) throw new Error('refresh token');
    req.user=claims;
  } catch {
    return next(new HttpError(401,'Jeton invalide ou expiré','AUTH_INVALID'));
  }
  pool.query(`SELECT u.id,u.role,u.status,u.auth_version,coalesce(json_agg(json_build_object('role',ur.role,'verified_at',ur.verified_at,'kyc_level',ur.kyc_level)) FILTER (WHERE ur.role IS NOT NULL),'[]'::json) AS roles FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id WHERE u.id=$1 GROUP BY u.id`,[req.user.sub])
    .then(({rows})=>{
      const u=rows[0];
      if(!u) throw new HttpError(401,'Compte introuvable','AUTH_USER_NOT_FOUND');
      if(u.status!=='active') throw new HttpError(403,'Compte indisponible','ACCOUNT_DISABLED');
      // Never trust a stale role or access token version embedded in a token.
      if(Number(req.user.av||0)!==Number(u.auth_version||1)) throw new HttpError(401,'Session expirée, veuillez vous reconnecter','AUTH_SESSION_REVOKED');
      req.user.role=u.role;
      req.user.roles=Array.isArray(u.roles)?u.roles:[];
      next();
    })
    .catch(next);
}

export const requireRoles=(...roles)=>(req,res,next)=> {
  const active = new Set((req.user?.roles||[]).map(r => typeof r === 'string' ? r : r.role));
  if (req.user?.role) active.add(req.user.role);
  return roles.some(role => active.has(role)) ? next() : next(new HttpError(403,'Accès interdit','FORBIDDEN'));
};

export const requireKycLevel=(role,level=3)=>(req,res,next)=>{
  const entry=(req.user?.roles||[]).find(r => (typeof r==='string'?r:r.role)===role);
  const verifiedAt=typeof entry==='object'?entry.verified_at:null;
  const kycLevel=Number(typeof entry==='object'?entry.kyc_level:0);
  if(!verifiedAt || kycLevel<level) return next(new HttpError(403,'Vérification KYC requise','KYC_REQUIRED'));
  next();
};
