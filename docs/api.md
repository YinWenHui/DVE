# HTTP API

All responses use JSON except CSV/XLSX downloads. Errors use `{ "error": { "code", "message", "details"? } }`; production responses omit secrets, SQL text, credentials, and stack traces.

| Route | Method | Permission | Purpose |
| --- | --- | --- | --- |
| `/api/health` | GET | Public | Process/data-store health without secrets |
| `/api/auth/login` | POST | Public | Password or non-production preview session |
| `/api/auth/logout` | POST | Session | Revoke cookie session |
| `/api/auth/me` | GET | Session | Current safe user profile |
| `/api/apps` | GET/POST | Read/Admin | Visible apps or app creation |
| `/api/apps/[appId]` | PUT | Admin | Validated app update/publish |
| `/api/reports` | GET/POST | Read/Admin | Reports or report creation |
| `/api/reports/[reportId]` | PUT | Admin | Report layout update |
| `/api/datasets` | GET/POST | Query/Admin | Datasets or staged import activation |
| `/api/datasets/upload` | POST | Admin | XLSX/CSV validation, sheet/header/delimiter preview |
| `/api/datasets/[datasetId]/preview` | GET | Query | Visible field preview |
| `/api/datasets/[datasetId]/refresh` | POST | Query | Manual refresh/run record |
| `/api/query` | POST | Query | Structured visual query |
| `/api/export?format=csv|xlsx` | POST | Export | Filtered, permission-aware export |
| `/api/comments` | GET/POST | Read/Supervisor+ | Comment history/create |
| `/api/alerts` | GET | Read | Alert events |
| `/api/alerts/[alertId]/acknowledge` | POST | Supervisor+ | Audited acknowledgement |
| `/api/audiences` | POST | Admin | Create audience assignment |
| `/api/data-sources/test` | POST | Admin | One-time SQL connection test |
| `/api/integrations/power-automate` | POST | Integration key | Machine event intake |

## Query request

```json
{
  "datasetId": "dataset-manufacturing-output",
  "dimensions": ["Line"],
  "measures": [{ "field": "ActualQty", "aggregation": "sum", "alias": "Actual" }],
  "filters": [{ "field": "RecordDate", "operator": "between", "value": ["2026-01-01", "2026-01-31"] }],
  "sort": [{ "field": "Line", "direction": "asc" }],
  "limit": 5000
}
```

Operators: equals, notEquals, greaterThan, greaterThanOrEqual, lessThan, lessThanOrEqual, in, contains, startsWith, between, isNull, and isNotNull. Aggregations: sum, average, minimum, maximum, count, and distinctCount. Every identifier must be registered dataset metadata.

## Upload flow

Post multipart `file`, optional `sheet`, one-based `headerRow`, and optional `delimiter`. The response contains a short-lived `uploadId`, detected fields, sheet names, encoding, row count, and preview. Review/edit metadata, then POST `/api/datasets`. SQL mode writes a new version and activates only after validation.
