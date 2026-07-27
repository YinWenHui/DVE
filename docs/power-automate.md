# Power Automate integration

Phase 1 does not call Microsoft Graph. Power Automate is the controlled bridge for Microsoft Lists, saved attachments, notifications, and approved workflows.

## List synchronization

```text
Microsoft List item created/modified
  -> Power Automate trigger
  -> map approved fields to the payload below
  -> HTTP POST to Digital Verse
  -> validate X-DVE-Integration-Key
  -> upsert/record staging event
  -> scheduled dataset refresh consumes staging data
```

Configure a long random `DVE_INTEGRATION_KEY` in the host environment and the Power Automate secure connection/action. Never place it in a flow description, repository, screenshot, or report. Restrict the endpoint to the company network when possible.

Request:

```http
POST /api/integrations/power-automate
Content-Type: application/json
X-DVE-Integration-Key: <secret>
```

```json
{
  "source": "ManufacturingActionList",
  "eventType": "list.item.updated",
  "externalId": "item-1042",
  "occurredAt": "2026-07-25T09:10:00Z",
  "data": {
    "status": "Approved",
    "category": "Quality follow-up",
    "ownerReference": "team-alpha"
  }
}
```

Valid event types are `list.item.created`, `list.item.updated`, `attachment.saved`, `workflow.notification`, and `workflow.approved`. A successful response is `202 Accepted` with an event ID. Configure retry for 429/5xx with exponential backoff; do not retry 400/401 without fixing configuration.

For email attachments, first save to a restricted inbound directory, then call the endpoint with a synthetic or business-safe reference. Python performs file validation and import; Excel Desktop is not required.
