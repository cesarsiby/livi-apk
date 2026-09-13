// V42 — observability audit finding: before this file, the ONLY thing the
// server ever logged was errors (the Express error handler in
// src/server.js). A successful request produced zero log output. This
// means an operator watching production logs would have no visibility
// into request volume, per-route latency, or even which endpoints are
// being used — the mission explicitly asks (V42) whether "il existe un
// chemin clair pour détecter une anomalie en production avant qu'un
// utilisateur ne la signale", and with no access logging at all, the
// honest answer was no: a slow endpoint, a spike in 4xx from a broken
// client integration, or a silently-failing background pattern would only
// surface once a person complained.
//
// This middleware logs one structured line per completed request: method,
// path, status, duration, and the correlation id already established by
// requestId middleware (so an error log line and its corresponding access
// log line can be joined). It deliberately does NOT log request/response
// bodies, headers, or query strings — those can carry PII or secrets, and
// redaction is already handled precisely (and only) for the error path via
// redactSensitive(); duplicating that surface here just to log an access
// line is unnecessary risk for no benefit. Health-check traffic is skipped
// to avoid flooding logs with a near-constant, uninteresting signal from
// load balancer / orchestrator probes.

export function requestLog(req, res, next) {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    if (req.path.endsWith('/health')) return;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.log(JSON.stringify({
      type: 'request',
      request_id: res.locals.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: Math.round(durationMs * 100) / 100
    }));
  });
  next();
}
