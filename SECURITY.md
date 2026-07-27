# Security policy

Digital Verse handles internal reporting data and credentials. Treat production deployments as sensitive internal systems.

Report suspected vulnerabilities privately to the repository owner; do not open a public issue containing exploit details, credentials, connection strings, or company data.

## Deployment requirements

- Disable mock authentication in production (`AUTH_MODE=sql`). The application rejects production mock sessions.
- Use HTTPS through a hardened reverse proxy before transmitting credentials.
- Use a dedicated least-privilege SQL login. Separate migration privileges from runtime privileges where practical.
- Supply a random 32-byte base64 `APP_ENCRYPTION_KEY`; rotate it using an explicit secret-reencryption procedure.
- Keep `.env`, uploads, exports, and logs outside source control and restrict their Windows ACLs.
- Rotate `DVE_INTEGRATION_KEY`; use a long random value and restrict the endpoint at the network layer.
- Store only password hashes and session-token hashes. Never log request bodies for authentication or data-source endpoints.
- Patch Node.js, Python, SQL Server, the ODBC driver, dependencies, Windows, and IIS according to company policy.
- Back up SQL metadata, active and previous dataset versions, encryption keys, and deployment configuration separately.

The prototype is designed for an internal trusted network and still requires security review, penetration testing, logging integration, rate limits, CSRF review, and TLS hardening before production approval.
