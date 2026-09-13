import crypto from 'node:crypto';
export function requestId(req,res,next){ const id=req.get('x-request-id') || `livi-${crypto.randomUUID()}`; res.locals.requestId=id; res.set('x-request-id',id); next(); }
