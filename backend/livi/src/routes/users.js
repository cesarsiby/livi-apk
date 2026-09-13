import { Router } from 'express'; import { z } from 'zod'; import { pool,tx } from '../config/db.js'; import { asyncHandler,ok,HttpError } from '../utils/http.js'; import { requireAuth } from '../middleware/auth.js';
const r=Router(); r.use(requireAuth);
r.get('/me',asyncHandler(async(req,res)=>{
  const {rows}=await pool.query(`SELECT u.id,u.phone,u.name,u.role,u.status,u.phone_verified,u.email,u.email_verified,u.created_at,
    coalesce(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL),ARRAY[u.role]) roles,
    coalesce(json_agg(json_build_object('role',ur.role,'verified_at',ur.verified_at,'kyc_level',ur.kyc_level)) FILTER (WHERE ur.role IS NOT NULL),'[]'::json) role_details
    FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id WHERE u.id=$1 GROUP BY u.id`,[req.user.sub]);
  if(!rows[0])throw new HttpError(404,'Utilisateur introuvable');
  ok(res,rows[0]);
}));r.patch('/me',asyncHandler(async(req,res)=>{const name=typeof req.body?.name==='string'?req.body.name.trim():null; if(!name)throw new HttpError(422,'Nom invalide'); const {rows}=await pool.query('UPDATE users SET name=$1,updated_at=now() WHERE id=$2 RETURNING id,phone,name,role,status',[name,req.user.sub]); ok(res,rows[0]);}));

r.get('/me/roles',asyncHandler(async(req,res)=>ok(res,(await pool.query('SELECT role,verified_at,kyc_level,created_at FROM user_roles WHERE user_id=$1 ORDER BY role',[req.user.sub])).rows)));
r.post('/me/roles',asyncHandler(async(req,res)=>{const b=z.object({role:z.enum(['client','vendor','transporter'])}).parse(req.body);const result=await tx(async c=>{const u=(await c.query('SELECT id,name,phone FROM users WHERE id=$1 FOR UPDATE',[req.user.sub])).rows[0];if(!u)throw new HttpError(404,'Utilisateur introuvable');await c.query('INSERT INTO user_roles(user_id,role) VALUES($1,$2) ON CONFLICT DO NOTHING',[u.id,b.role]);if(b.role==='vendor')await c.query("INSERT INTO vendors(id,shop_name,slug) VALUES($1,$2,lower(regexp_replace($2,'[^a-zA-Z0-9]+','-','g'))) ON CONFLICT DO NOTHING",[u.id,u.name]);if(b.role==='transporter')await c.query('INSERT INTO transporters(id) VALUES($1) ON CONFLICT DO NOTHING',[u.id]);return (await c.query('SELECT role,verified_at,kyc_level,created_at FROM user_roles WHERE user_id=$1 AND role=$2',[u.id,b.role])).rows[0]});ok(res,result,201)}));

export default r;
