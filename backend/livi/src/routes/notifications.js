import {Router} from 'express'; import {pool} from '../config/db.js'; import {asyncHandler,ok,HttpError} from '../utils/http.js'; import {requireAuth} from '../middleware/auth.js';
const r=Router();r.use(requireAuth);
// V48: was a bare `SELECT * ... LIMIT 100` array — ignored ?cursor= entirely
// and had no unread count. notificationsApi.ts (features/notifications) and
// NotificationsProvider.tsx always read page.items / page.unreadCount from
// the response; neither ever existed, so the notification list and the
// unread badge were always empty regardless of how many notifications a
// user actually had.
r.get('/',asyncHandler(async(req,res)=>{const cursor=req.query.cursor?String(req.query.cursor):null;const items=(await pool.query(cursor?'SELECT * FROM notifications WHERE user_id=$1 AND created_at<$2 ORDER BY created_at DESC LIMIT 100':'SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',cursor?[req.user.sub,cursor]:[req.user.sub])).rows;const unread_count=(await pool.query('SELECT count(*)::int c FROM notifications WHERE user_id=$1 AND read_at IS NULL',[req.user.sub])).rows[0].c;ok(res,{items,next_cursor:items.length===100?items[items.length-1].created_at:null,unread_count})}));
r.post('/:id/read',asyncHandler(async(req,res)=>{const x=(await pool.query('UPDATE notifications SET read_at=coalesce(read_at,now()) WHERE id=$1 AND user_id=$2 RETURNING id,read_at',[req.params.id,req.user.sub])).rows[0];if(!x)throw new HttpError(404,'Notification introuvable');ok(res,x)}));
// V47: notificationsApi.ts's markAllRead() called this path with no matching
// route (404 on every "mark all as read" tap).
r.post('/read-all',asyncHandler(async(req,res)=>{const {rowCount}=await pool.query('UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL',[req.user.sub]);ok(res,{updated:rowCount})}));
export default r;
