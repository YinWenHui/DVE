# Migration from Power BI

There is no automatic PBIX importer. PBIX files are migration references only.

| Existing asset | Digital Verse target |
| --- | --- |
| Power Query M | Reviewed Python transform or SQL ETL/view |
| DAX measure | Approved built-in calculation, SQL expression/view, or future expression tree |
| Report page | Metadata-defined report page |
| Visual | ECharts, TanStack Table, matrix, slicer, or custom approved component |
| Power BI App | Digital Verse application |
| App section | Collapsible application section |
| App audience | Role/user audience and visible report assignments |
| Scheduled refresh | Independent Digital Verse refresh worker |

## Migration procedure

1. Inventory apps, reports, pages, sources, refresh cadence, roles, audiences, exports, and owners.
2. Classify source data and remove confidential samples from development artifacts.
3. Document each Power Query step, then reproduce it with deterministic Python/SQL tests.
4. Inventory DAX dependencies. Map simple sums/averages/counts/differences/ratios to controlled measures; defer context-heavy DAX until the Phase 2 model is designed.
5. Register a single-table semantic dataset with safe keys, types, formats, aggregations, filters, retention, and refresh policy.
6. Rebuild pages with metadata visuals and compare totals, filters, dates, rounding, and blank handling against an approved baseline.
7. Recreate app section order and audiences. Test every role server-side.
8. Run both platforms in parallel, validate refresh/failure behavior, obtain business-owner signoff, then retire the legacy artifact under change control.

Relationships, calculated tables, bidirectional filters, row-level security logic, bookmarks, tooltips, drill-through, and unsupported custom visuals require explicit redesign. Do not claim parity until acceptance tests confirm it.
