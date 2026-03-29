module.exports = (...requiredScopes) => (req, res, next) => {
  if (req.authContext?.type !== "apiKey") return next();

  const grantedScopes = Array.isArray(req.authContext.scopes) ? req.authContext.scopes : [];
  const allowed = requiredScopes.some((scope) => grantedScopes.includes(scope));

  if (!allowed) {
    return res.status(403).json({
      success: false,
      msg: `API key missing required scope. Need one of: ${requiredScopes.join(", ")}`,
    });
  }

  next();
};
