const MIN_SUPPORTED_VERSION = '1.0.0';

function semverCompare(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export const enforceClientVersion = (req, res, next) => {
  const url = req.originalUrl || req.path || '';

  // Skip version check for system version endpoint itself, health check, or static assets
  if (
    url.includes('/api/system/version') ||
    url.includes('/api/health') ||
    url.startsWith('/uploads')
  ) {
    return next();
  }

  const clientVersion = req.headers['x-client-version'];
  if (clientVersion) {
    if (semverCompare(clientVersion, MIN_SUPPORTED_VERSION) < 0) {
      return res.status(426).json({
        success: false,
        code: 'CLIENT_VERSION_OBSOLETE',
        message: `Your client version (${clientVersion}) is outdated and no longer supported. Please update to version ${MIN_SUPPORTED_VERSION} or higher to continue.`
      });
    }
  }

  next();
};
