# Contributing

1. Branch from the current remote `main` using a focused `agent/`, `feature/`, or `fix/` branch.
2. Use synthetic data. Do not add company names, paths, employee identifiers, production values, customer data, credentials, or secrets.
3. Keep TypeScript strict, validate server inputs with Zod, enforce permissions server-side, and parameterize SQL values.
4. Add or update tests for behavior changes.
5. Run `npm run lint`, `npm run type-check`, `npm test`, and `npm run build`.
6. Inspect `git diff --cached` and confirm `.env`, uploads, exports, logs, build output, and confidential files are not staged.
7. Open a draft pull request describing behavior, architecture impact, validation, limitations, and security considerations.

Do not add a license file without repository-owner approval.
