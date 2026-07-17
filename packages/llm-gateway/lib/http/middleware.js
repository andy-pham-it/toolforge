'use strict';

/**
 * Attach unique request ID to every request.
 */
function requestId(req, res, next) {
  req.requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

/**
 * Attach AbortSignal to detect client disconnection.
 * Gateway checks ctx.signal?.aborted to cancel upstream calls.
 */
function requestCancellation(req, res, next) {
  const controller = new AbortController();
  req.signal = controller.signal;
  req.on('close', () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  });
  next();
}

module.exports = { requestId, requestCancellation };
