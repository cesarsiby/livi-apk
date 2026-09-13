export function secureHeaders(req,res,next){
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','camera=(self), microphone=(), geolocation=(self), payment=()');
  res.setHeader('X-Frame-Options','DENY');
  if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  next();
}
