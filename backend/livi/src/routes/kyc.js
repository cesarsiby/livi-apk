import {Router} from 'express';
import {z} from 'zod';
import {pool} from '../config/db.js';
import {asyncHandler,ok,HttpError} from '../utils/http.js';
import {requireAuth,requireRoles} from '../middleware/auth.js';
import {audit} from '../services/audit.js';
import {assertSafeFileKey,noStoreSensitive} from '../middleware/security.js';
import {createFileAccessToken,verifyFileAccessToken,statPrivateFile,streamPrivateFile} from '../services/privateFileAccess.js';
import {enqueueNotification} from '../services/notifications.js';

const r=Router(); r.use(requireAuth);

r.get('/mine',noStoreSensitive,asyncHandler(async(req,res)=>ok(res,(await pool.query('SELECT id,document_type,status,rejection_reason,created_at,reviewed_at FROM kyc_documents WHERE user_id=$1 ORDER BY created_at DESC',[req.user.sub])).rows)));

// document_type enum, shared with the real submission route
// (POST /users/me/kyc in compatibility.js) so both stay in sync.
export const KYC_DOCUMENT_TYPES = ['cni','passport','permis','assurance','business_registration','tax_document','identity','business','address','other'];

async function loadAuthorizedDocument(id,userId,isAdmin=false){
  const d=(await pool.query('SELECT id,user_id,document_type,status,file_key FROM kyc_documents WHERE id=$1',[id])).rows[0];
  if(!d) throw new HttpError(404,'Document KYC introuvable');
  if(!isAdmin && d.user_id!==userId) throw new HttpError(403,'Accès refusé');
  return d;
}

r.post('/documents/:id/access-token',noStoreSensitive,asyncHandler(async(req,res)=>{
  const d=await loadAuthorizedDocument(req.params.id,req.user.sub,false);
  if(d.status==='rejected') throw new HttpError(403,'Document KYC rejeté');
  // V-AUDIT (section 32 — KYC document permissions): this route has no
  // requireRoles('admin') guard and is reachable by any authenticated user
  // for their own document only (loadAuthorizedDocument(...,false) above
  // enforces d.user_id===userId). It used to stamp role:'admin' on the
  // token regardless — verifyFileAccessToken's documentId binding happens
  // to stop that from being reused against a *different* document today,
  // but a user-issued token should never carry an admin claim it wasn't
  // actually granted; that guarantee shouldn't depend on a second,
  // unrelated check staying exactly as strict as it is today. USER_DOCUMENT_ACCESS:
  // no role claim at all — userOk in verifyFileAccessToken (data.u matching
  // the caller) is already sufficient for a person accessing their own document.
  const token=createFileAccessToken({documentId:d.id,userId:req.user.sub,ttlSeconds:300});
  ok(res,{token,expires_in_seconds:300});
}));

r.get('/documents/:id/download',noStoreSensitive,asyncHandler(async(req,res)=>{
  const d=(await pool.query('SELECT id,user_id,document_type,status,file_key FROM kyc_documents WHERE id=$1',[req.params.id])).rows[0];
  if(!d) throw new HttpError(404,'Document KYC introuvable');
  const token=String(req.query.token||'');
  if(!verifyFileAccessToken(token,{documentId:d.id,allowedUserIds:[d.user_id,req.user.sub],allowAdmin:true})) throw new HttpError(403,'Jeton d’accès invalide ou expiré');
  if(d.status==='rejected') throw new HttpError(403,'Document KYC rejeté');
  const st=await statPrivateFile(d.file_key).catch(()=>null);
  if(!st || !st.isFile()) throw new HttpError(404,'Fichier KYC indisponible');
  res.setHeader('Content-Type','application/octet-stream');
  res.setHeader('Content-Length',String(st.size));
  res.setHeader('Content-Disposition',`attachment; filename="livi-kyc-${d.id}"`);
  streamPrivateFile(d.file_key).on('error',()=>{if(!res.headersSent) res.status(404).end();}).pipe(res);
  await audit({actorUserId:req.user.sub,action:'kyc.document.downloaded',entityType:'kyc_document',entityId:d.id,requestId:res.locals.requestId,ip:req.ip,userAgent:req.get('user-agent'),after:{document_id:d.id}});
}));

r.get('/admin/pending',noStoreSensitive,requireRoles('admin'),asyncHandler(async(req,res)=>ok(res,(await pool.query("SELECT id,user_id,document_type,status,rejection_reason,reviewed_by,reviewed_at,created_at FROM kyc_documents WHERE status='pending' ORDER BY created_at ASC LIMIT 100")).rows)));

r.post('/admin/:id/access-token',noStoreSensitive,requireRoles('admin'),asyncHandler(async(req,res)=>{
  const d=await loadAuthorizedDocument(req.params.id,req.user.sub,true);
  // ADMIN_DOCUMENT_ACCESS: role:'admin' is legitimate here — this route is
  // gated by requireRoles('admin') above, unlike POST /documents/:id/access-token.
  const token=createFileAccessToken({documentId:d.id,userId:req.user.sub,role:'admin',ttlSeconds:300});
  await audit({actorUserId:req.user.sub,action:'kyc.document.admin_access_token_issued',entityType:'kyc_document',entityId:d.id,requestId:res.locals.requestId,ip:req.ip,userAgent:req.get('user-agent'),after:{document_id:d.id,expires_in_seconds:300}});
  ok(res,{token,expires_in_seconds:300});
}));

r.post('/admin/:id/review',requireRoles('admin'),asyncHandler(async(req,res)=>{
  const s=z.object({status:z.enum(['approved','rejected']),rejection_reason:z.string().max(500).optional()}).parse(req.body);const c=await pool.connect();
  try{await c.query('BEGIN');const d=(await c.query('SELECT * FROM kyc_documents WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!d)throw new HttpError(404,'Document KYC introuvable');const row=(await c.query('UPDATE kyc_documents SET status=$1,rejection_reason=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$4 RETURNING id,user_id,document_type,status,rejection_reason,reviewed_by,reviewed_at,created_at',[s.status,s.rejection_reason||null,req.user.sub,d.id])).rows[0];if(s.status==='approved'){await c.query("UPDATE users SET status='active',updated_at=now() WHERE id=$1",[d.user_id]); await c.query("UPDATE vendors SET kyc_status='approved',certified_at=now() WHERE id=$1",[d.user_id]); await c.query("UPDATE transporters SET kyc_status='approved',certified_at=now() WHERE id=$1",[d.user_id]); await c.query("UPDATE user_roles SET verified_at=now(),kyc_level=3 WHERE user_id=$1 AND role IN ('vendor','transporter')",[d.user_id]); await enqueueNotification(c,{userId:d.user_id,type:'kyc_approved',title:'KYC approuvé',body:'Votre vérification KYC a été approuvée.',data:{document_id:d.id}});}if(s.status==='rejected') await enqueueNotification(c,{userId:d.user_id,type:'kyc_rejected',title:'KYC à corriger',body:s.rejection_reason||'Votre document KYC a été rejeté.',data:{document_id:d.id}}); await audit({actorUserId:req.user.sub,action:'kyc.document.reviewed',entityType:'kyc_document',entityId:d.id,requestId:res.locals.requestId,ip:req.ip,userAgent:req.get('user-agent'),before:d,after:row},c);await c.query('COMMIT');ok(res,row)}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
}));
export default r;
