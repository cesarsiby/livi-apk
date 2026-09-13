import express from 'express'; import helmet from 'helmet'; import cors from 'cors'; import rateLimit from 'express-rate-limit'; import { env } from './config/env.js'; import { pool } from './config/db.js'; import api from './routes/index.js'; import { requestId } from './middleware/requestId.js'; import { redactSensitive } from './utils/redaction.js'; import { idempotency } from './middleware/idempotency.js'; import { secureHeaders } from './middleware/secureHeaders.js'; import { requestLog } from './middleware/requestLog.js';
import { autoReleaseEligibleEscrows } from './services/escrowScheduler.js';
import { sweepExpiredMissionOffers } from './services/missionScheduler.js';

// V42 — observability audit finding: there was no top-level handler for
// uncaughtException/unhandledRejection. Any error thrown outside Express's
// own request-handling try/catch machinery (e.g. in a fire-and-forget
// async call, a timer callback, or a bug in code that isn't awaited)
// would previously be invisible — Node's default behavior differs by
// event but in no case does it produce the same structured, correlated
// log line the rest of this service relies on. Per Node's own guidance,
// an uncaughtException means the process is in an undefined state; the
// safe response is to log with full context and exit so a process
// manager (systemd, Docker, PM2, k8s) restarts it — not to keep serving
// requests from a potentially corrupted process.
process.on('uncaughtException', (err) => {
  console.error(JSON.stringify(redactSensitive({ type: 'uncaughtException', error: { name: err?.name, message: err?.message, stack: err?.stack } })));
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  console.error(JSON.stringify(redactSensitive({ type: 'unhandledRejection', error: { name: err?.name, message: err?.message, stack: err?.stack } })));
  process.exit(1);
});

const app=express(); app.set('trust proxy',1); app.use(helmet({contentSecurityPolicy:false,referrerPolicy:{policy:'no-referrer'}})); app.use(secureHeaders); app.use(cors({origin:(origin,cb)=>{if(!origin)return cb(null,true);const allowed=(env.ALLOWED_ORIGINS||env.CORS_ORIGIN).split(',').map(v=>v.trim()).filter(Boolean);cb(null,allowed.includes(origin)?origin:false)},credentials:true})); app.use(express.json({limit:'256kb',verify:(req,_res,buf)=>{req.rawBody=buf.toString('utf8')}})); app.use(requestId); app.use(requestLog); app.use(idempotency); app.use(rateLimit({windowMs:60_000,max:180,standardHeaders:true,legacyHeaders:false})); app.use('/api/v1',api);
app.use((req,res)=>res.status(404).json({success:false,error:{code:'NOT_FOUND',message:'Route introuvable'},request_id:res.locals.requestId}));
app.use((err,req,res,next)=>{
  console.error(redactSensitive({request_id:res.locals.requestId,error:{name:err?.name,message:err?.message,code:err?.code,status:err?.status,stack:process.env.NODE_ENV==='production'?undefined:err?.stack}}));
  // V-AUDIT: zod's .parse(req.body) is used throughout src/routes/* for
  // request validation. A ZodError has no `.status`, so it used to fall
  // through to the `err.status||500` default below — every malformed
  // request body anywhere in the API (missing field, wrong type, string
  // too short, bad enum value) returned 500 'Erreur interne du serveur'
  // instead of a 400 the frontend could actually act on. Detected by
  // duck-typing (name + issues array) instead of `instanceof ZodError` so
  // this has no import dependency on zod's exact export shape.
  const isZod = err?.name==='ZodError' && Array.isArray(err?.issues);
  const status = isZod ? 400 : (err.status||500);
  const code = isZod ? 'VALIDATION_ERROR' : (err.code||'INTERNAL_ERROR');
  const message = status>=500 ? 'Erreur interne du serveur' : (isZod ? 'Données invalides.' : err.message);
  const details = status<500 ? (isZod ? err.issues.map(i=>({path:i.path.join('.'),message:i.message})) : err.details) : null;
  res.status(status).json({success:false,error:{code,message,details},request_id:res.locals.requestId});
});
const server=app.listen(env.PORT,()=>console.log(`LIVI API listening on :${env.PORT}`));
const scheduler=setInterval(()=>{
  autoReleaseEligibleEscrows().catch(err=>{
    console.error(JSON.stringify(redactSensitive({type:'escrow_auto_release_scheduler_error',error:{message:err?.message,stack:err?.stack}})));
  });
},60*60*1000);
if(scheduler.unref) scheduler.unref();
// V54: 30s, not 60min like the escrow scheduler above — a 5-minute offer
// window needs to be noticed and reassigned promptly, not up to an hour
// late.
const missionScheduler=setInterval(()=>{
  sweepExpiredMissionOffers().catch(err=>{
    console.error(JSON.stringify(redactSensitive({type:'mission_offer_sweep_error',error:{message:err?.message,stack:err?.stack}})));
  });
},30*1000);
if(missionScheduler.unref) missionScheduler.unref();
process.on('SIGTERM',async()=>{clearInterval(scheduler);clearInterval(missionScheduler);server.close();await pool.end();process.exit(0);});
