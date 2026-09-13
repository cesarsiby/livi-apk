import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, ok } from '../utils/http.js';
import { listSessions, revokeSession, revokeAllSessions, changePassword, sessionIdFromRequest } from '../services/authSessions.js';

const r=Router(); r.use(requireAuth);
r.get('/',asyncHandler(async(req,res)=>ok(res,await listSessions(req.user.sub,sessionIdFromRequest(req)))));
r.post('/logout-all',asyncHandler(async(req,res)=>ok(res,await revokeAllSessions(req.user.sub,null,'logout_all'))));
r.post('/:id/revoke',asyncHandler(async(req,res)=>ok(res,await revokeSession(req.user.sub,req.params.id))));
r.post('/password',asyncHandler(async(req,res)=>ok(res,await changePassword(req.user.sub,req.body?.current_password,req.body?.new_password))));
export default r;
