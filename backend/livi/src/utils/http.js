// V-AUDIT: constructor order is (status, message, code, details). Every call
// site in this codebase (202 at last count — routes, services, middleware)
// passes a short machine-readable string as the 3rd argument, e.g.
// `new HttpError(409, 'Numéro déjà utilisé', 'PHONE_ALREADY_REGISTERED')` —
// never a details object. The previous signature was
// (status, message, details=null, code=null), which silently routed every
// one of those strings into `details` and left `code` at its `null` default.
// The global error handler (server.js) does `code: err.code || 'INTERNAL_ERROR'`,
// so in practice *every* non-500 error the API ever returned had
// error.code === 'INTERNAL_ERROR', masking the real, specific code from any
// client that branches on it. Fixed by matching the order everyone already
// uses; no call site needed to change.
export class HttpError extends Error { constructor(status, message, code=null, details=null){ super(message); this.status=status; this.code=code; this.details=details; } }
export const asyncHandler = fn => (req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
export function ok(res,data,status=200){ return res.status(status).json({success:true,data,request_id:res.locals.requestId}); }
