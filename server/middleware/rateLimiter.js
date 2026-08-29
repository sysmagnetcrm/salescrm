// In-memory rate limiter for authentication endpoints
const loginAttempts = new Map();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10; // Max 10 attempts per window

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of loginAttempts.entries()) {
    if (now - data.startTime > WINDOW_MS) {
      loginAttempts.delete(ip);
    }
  }
}, 5 * 60 * 1000);

export const authRateLimiter = (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  const record = loginAttempts.get(ip);

  if (!record) {
    loginAttempts.set(ip, { count: 1, startTime: now });
    return next();
  }

  if (now - record.startTime > WINDOW_MS) {
    // Window expired, reset
    loginAttempts.set(ip, { count: 1, startTime: now });
    return next();
  }

  if (record.count >= MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((WINDOW_MS - (now - record.startTime)) / 1000);
    res.setHeader('Retry-After', retryAfterSeconds);
    return res.status(429).json({
      success: false,
      message: `Too many login attempts. Please try again after ${Math.ceil(retryAfterSeconds / 60)} minutes.`
    });
  }

  record.count += 1;
  next();
};
