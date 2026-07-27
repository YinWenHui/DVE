# Windows 11 deployment

## Host preparation

Use an always-on company-managed workstation with a stable hostname or reserved IP. Install a supported Node.js LTS release, Python 3.11+, Microsoft ODBC Driver 18, and network access to SQL Server. Disable sleep and hibernate, disable network-adapter power saving, enable approved automatic security updates/restarts, and document the service owner.

## Files and environment

Clone to a restricted service directory. Keep uploads, exports, and logs outside the repository (for example `C:\DigitalVerse\...`) with ACL access only for administrators and the service identity. Copy `.env.example` to an untracked `.env`, replace every placeholder, and protect the file. Never reuse example values.

## Build and run

```powershell
npm ci
npm run check
npm run build
npm run start       # 0.0.0.0:3000
npm run worker      # separate terminal/process
```

`scripts/start-production.ps1` starts both hidden child processes. For resilience, prefer a reviewed service wrapper or the provided Task Scheduler script. Run startup-task installation explicitly with the intended service account; it is not part of setup.

## Firewall and network

Test `http://localhost:3000/api/health`, then `http://<host>:3000/api/health` from an approved internal client. `scripts/open-firewall-rule.ps1` contains a commented example and never changes the firewall automatically. Have network/security administrators approve inbound port 3000 or the future reverse-proxy ports.

## IIS future hardening

Install IIS and Application Request Routing under company change control, terminate TLS on 443, redirect HTTP to HTTPS, preserve the client IP safely, set request/body/time limits, disable public directory browsing, and proxy to `127.0.0.1:3000`. After HTTPS is active, secure cookies are automatic in production. Do not expose Node port 3000 beyond required interfaces once IIS is in place.

## Startup and recovery

- Configure Task Scheduler/service restart on failure with a short delay.
- Start only after network and SQL Server are reachable.
- Send stdout/stderr to the configured external logs directory and integrate with monitoring.
- Monitor `/api/health`, worker heartbeat, refresh failures, disk capacity, SQL connectivity, and certificate expiry.
- On failure, stop web/worker, preserve logs, validate `.env`, test SQL, restore the last known application build, and restart. Dataset refresh failure does not remove the previous active version.

## Backup

Back up SQL Server metadata/audit and `dve_data` versions using approved full/differential/log strategy. Separately escrow encryption keys, environment configuration, Task Scheduler/service definition, and source-file retention configuration. Test restoration on another host. Exports and uploads are working files, not authoritative backups.

## Capacity and maintenance

Target load is about 50 registered and 20 concurrent users. Baseline CPU, memory, query time, worker duration, SQL pool use, and storage growth. Schedule dependency/OS/SQL patch windows and validate the smoke test after each change.
