# authorizer — Rules

The single API Gateway custom authorizer for the whole backend. Validates the JWT
and checks the session it references is still `is_active` in the `sessions` table
(this is what makes single-active-session enforcement actually take effect, not
just the login-time deactivation). On success, its `context` (userId, tenantId,
role, sessionId — all strings) is how every other feature's handler reads who's
calling. Never modify this to skip the session-active check.
