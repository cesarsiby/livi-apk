import { Router } from 'express'; import { authLimiter, otpLimiter } from '../middleware/security.js'; import { z } from 'zod'; import { asyncHandler,ok,HttpError } from '../utils/http.js'; import * as A from '../services/auth.js';
const r=Router();
// V-AUDIT (OTP/SMS removal from account opening): registration is now
// name + phone + password + password_confirmation only, checked here
// (zod .refine, backend — never trust the frontend match check alone)
// before register() is ever called. Minimum raised from 8 to 10 to match
// the minimum already enforced on the password-reset path
// (resetPasswordWithOtp / ResetNewPasswordScreen) — same account, same
// password, was two different rules depending on which screen set it.
const reg=z.object({
  phone:z.string().min(6).max(30),
  name:z.string().min(2).max(120).optional(),
  first_name:z.string().min(1).max(80).optional(),
  last_name:z.string().min(1).max(80).optional(),
  password:z.string().min(10).max(128),
  password_confirmation:z.string().min(10).max(128),
  role:z.enum(['client','vendor','transporter']).default('client'),
}).refine(d=>d.password===d.password_confirmation,{message:'Les deux mots de passe doivent être identiques.',path:['password_confirmation']});
const login=z.object({phone:z.string().min(6).max(30),password:z.string().min(1)});
// purpose defaults to 'password_reset' — the only caller left after the
// OTP/SMS removal above (see services/auth.js for the full removal
// rationale). /users/me/payment-methods/{verify,resend-otp}
// (routes/compatibility.js) are a separate, untouched OTP use for mobile
// money method verification, not phone/account verification.
r.post('/otp/send',otpLimiter,asyncHandler(async(req,res)=>ok(res,await A.sendOtp(req.body?.phone,req.body?.purpose||'password_reset'))));
r.post('/password/reset',otpLimiter,asyncHandler(async(req,res)=>{const b=z.object({phone:z.string().min(6).max(30),code:z.string().min(4).max(8),new_password:z.string().min(10).max(128)}).parse(req.body);ok(res,await A.resetPasswordWithOtp(b.phone,b.code,b.new_password))}));
r.post('/register',authLimiter,asyncHandler(async(req,res)=>ok(res,await A.register(reg.parse(req.body),{ip:req.ip,userAgent:req.get('user-agent'),deviceName:req.get('x-device-name')||null}),201)));
r.post('/login',authLimiter,asyncHandler(async(req,res)=>ok(res,await A.login(login.parse(req.body),{ip:req.ip,userAgent:req.get('user-agent'),deviceName:req.get('x-device-name')||null}))));
r.post('/refresh',authLimiter,asyncHandler(async(req,res)=>ok(res,await A.rotateRefresh(req.body?.refresh_token,{ip:req.ip,userAgent:req.get('user-agent'),deviceName:req.get('x-device-name')||null}))));
r.post('/logout',asyncHandler(async(req,res)=>{await A.logout(req.body?.refresh_token); ok(res,null,204);}));
export default r;
