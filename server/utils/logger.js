const sanitizeData = (data) => {
  if (!data || typeof data !== 'object') return data;
  const sanitized = Array.isArray(data) ? [...data] : { ...data };

  const sensitiveKeys = ['password', 'token', 'authorization', 'secret', 'jwt', 'buffer', 'audio'];

  Object.keys(sanitized).forEach((key) => {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED_SENSITIVE_DATA]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  });

  return sanitized;
};

export const logger = {
  info: (event, details = {}) => {
    console.log(`[INFO] [${new Date().toISOString()}] [${event}]`, JSON.stringify(sanitizeData(details)));
  },
  warn: (event, details = {}) => {
    console.warn(`[WARN] [${new Date().toISOString()}] [${event}]`, JSON.stringify(sanitizeData(details)));
  },
  error: (event, error, details = {}) => {
    console.error(`[ERROR] [${new Date().toISOString()}] [${event}]`, {
      message: error?.message || String(error),
      stack: error?.stack,
      details: sanitizeData(details)
    });
  }
};
