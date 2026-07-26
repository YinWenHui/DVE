# Front-end parity plan

Digital Verse targets a familiar, capable self-service BI workflow on this pilot PC. It does not copy Microsoft branding, proprietary code, PBIX internals, DAX, Power Query, or licensed visuals. “Power BI-style parity” means equivalent user outcomes for the feature categories that matter to this internal product.

The categories are based on the current Microsoft documentation for [Power BI reports](https://learn.microsoft.com/en-us/power-bi/create-reports/power-bi-reports-overview), [visualizations and scoped filters](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualizations-overview), [the format pane](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-format-pane-overview), [bookmarks](https://learn.microsoft.com/en-us/power-bi/explore-reports/end-user-bookmarks), [drillthrough](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-drillthrough), and [buttons](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-buttons).

## Delivery boundary

Hosting, production security hardening, service packaging, centralized monitoring, backup operations, and production system administration remain explicitly deferred until the front-end milestone is accepted. Existing authorization and safe query boundaries stay enabled; they are not removed during front-end work.

## Implemented now

| Capability | Current Digital Verse behavior |
| --- | --- |
| Report consumption | Multi-page reports, responsive canvas, application navigation, freshness context, theme/fullscreen, loading skeletons, and actionable empty/no-result/stale/offline/error states |
| Visual catalog | KPI, bar, column, stacked bar/column, line, area, combo, scatter, doughnut, treemap, funnel, waterfall, gauge, table, matrix, slicer |
| Filtering | Viewer filters plus persisted report-, page-, and visual-level basic/advanced filters, AND/OR clauses, Top/Bottom N, rolling/current relative dates, locked and hidden constraints, and authored visual sort order |
| Interactions | Persisted source-to-target filter/highlight/none editing, hierarchy drill down/up/expand controls, hidden drillthrough targets with carried filter context/back navigation, authored page/bookmark/back/reset buttons, page and bookmark navigators, slicers, tooltips, reset/clear, focus mode, show underlying data |
| Personalization | Persisted report-owned bookmarks with page/filter state plus browser-local personal bookmarks |
| Authoring | Live visual previews, draggable/resizable grid, ordered category/value/tooltip wells, multi-measure series, legend splitting, small multiples, field reordering, aggregation and number format, capped undo/redo history, object copy/paste, and a selection pane with visibility and ordering |
| Formatting | Persisted report themes, reusable visual format presets, page backgrounds/wallpapers, visible and configurable snap grids, title visibility/alignment, accent/background colors, radius, legend, labels, gridlines, tooltip and cross-filter switches, plus ordered threshold rules for chart/KPI colors and table/matrix backgrounds, text, and data bars |
| Pages | Add, rename, duplicate, hide/show, delete, style, and configure authoring-grid behavior |
| Distribution | Published app navigation, audience visibility, comments, CSV and Excel data export |

## Remaining front-end phases

### Front-end phase C — authoring depth

- Text boxes, shapes, images, KPI targets, and richer table/matrix column configuration.
- Mobile layout authoring, accessibility inspection, keyboard editing, and high-contrast validation.
- Geographic visuals after the approved offline map strategy is selected.

### Front-end phase D — distribution experience

- PDF and image export, then PowerPoint generation.
- Subscription, scheduled delivery, kiosk/play mode, and presentation navigation.
- Usage views, favorites/recent items, endorsement labels, and richer workspace browsing.

## Acceptance rule

A feature is marked complete only when its control performs the behavior, its metadata persists when appropriate, and automated checks cover the critical path. Placeholder buttons are not counted as parity.
