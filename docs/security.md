# Security architecture

## Trust boundaries

Browsers are untrusted. Roles, fields, filters, row limits, export limits, and entity access are checked on the server. The web process is not a SQL client proxy and never accepts raw SQL. Power Automate is a distinct machine identity using `X-DVE-Integration-Key`.

## Credentials and sessions

Passwords use bcrypt and are never logged or returned. Production session tokens contain 256 random bits, are delivered in HttpOnly/SameSite=Lax cookies, and only SHA-256 hashes are stored. Production cookies require HTTPS. Logout revokes the session; expired/revoked tokens fail closed. Mock identity uses a signed expiring preview token, is synthetic and visible, grants no production data access, and is disabled in production.

Data-source secrets use AES-256-GCM with a random IV and authenticated tag. `APP_ENCRYPTION_KEY` is external configuration, not a committed value. Key loss makes encrypted source credentials unrecoverable; key disclosure requires credential and key rotation.

## Query and import safety

Zod validates request shape. Identifiers must exactly match registered metadata and are bracket-quoted after validation. Values are parameters. File extension, size, headers, row count, schema, and types are validated. Physical object names derive from UUIDs. Imports run in transactions and activate only after validation.

## Remaining production controls

Add login and API rate limiting, CSRF testing/protection decisions, account lockout policy validation, Content Security Policy, central audit/log forwarding, malware scanning for uploads, security headers at IIS, dependency monitoring, penetration testing, SQL permission review, backup restore exercises, and incident-response runbooks before production approval.
