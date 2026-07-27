# Front-end parity plan

Digital Verse targets a familiar, capable self-service BI workflow on this pilot PC. It does not copy Microsoft branding, proprietary code, PBIX internals, DAX, Power Query, or licensed visuals. “Power BI-style parity” means equivalent user outcomes for the feature categories that matter to this internal product.

The categories are based on the current Microsoft documentation for [Power BI reports](https://learn.microsoft.com/en-us/power-bi/create-reports/power-bi-reports-overview), [visualizations and scoped filters](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualizations-overview), [the format pane](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-format-pane-overview), [bookmarks](https://learn.microsoft.com/en-us/power-bi/explore-reports/end-user-bookmarks), [drillthrough](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-drillthrough), and [buttons](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-buttons).

## Delivery boundary

Hosting, production security hardening, service packaging, centralized monitoring, backup operations, and production system administration remain explicitly deferred until the front-end milestone is accepted. Existing authorization and safe query boundaries stay enabled; they are not removed during front-end work.

## Implemented now

| Capability | Current Digital Verse behavior |
| --- | --- |
| Report consumption | Multi-page reports, responsive canvas, application navigation, freshness context, theme/fullscreen, loading skeletons, and actionable empty/no-result/stale/offline/error states |
| Visual catalog | KPI with constant/measure targets and variance, bar, column, stacked bar/column, line, area, combo, scatter, doughnut, treemap, funnel, waterfall, gauge, configurable table, configurable matrix, slicer, and a bundled offline geographic map with location/latitude/longitude/value wells |
| Filtering | Viewer filters plus persisted report-, page-, and visual-level basic/advanced filters, AND/OR clauses, Top/Bottom N, rolling/current relative dates, locked and hidden constraints, and authored visual sort order |
| Interactions | Persisted source-to-target filter/highlight/none editing, hierarchy drill down/up/expand controls, hidden drillthrough targets with carried filter context/back navigation, authored page/bookmark/back/reset buttons, page and bookmark navigators, slicers, tooltips, reset/clear, focus mode, show underlying data |
| Personalization | Persisted report-owned bookmarks with page/filter state, browser-local personal bookmarks, favorites, recent reports, per-device open counts, searchable/sortable workspace discovery, and certified/promoted content labels |
| Authoring | Live visual previews, draggable/resizable desktop and authored mobile grids, per-device visibility, text boxes, shapes, images, accessible object metadata, automated accessibility/contrast inspection, keyboard move/resize/delete, high-contrast preview, ordered category/value/tooltip wells, configurable table columns and matrix row/value wells, multi-measure series, legend splitting, small multiples, field reordering, aggregation and number format, capped undo/redo history, object copy/paste, and a selection pane with visibility and ordering |
| Formatting | Persisted report themes, reusable visual format presets, page backgrounds/wallpapers, visible and configurable snap grids, title visibility/alignment, accent/background colors, radius, legend, labels, gridlines, tooltip and cross-filter switches, plus ordered threshold rules for chart/KPI colors and table/matrix backgrounds, text, and data bars |
| Pages | Add, rename, duplicate, hide/show, delete, style, and configure authoring-grid behavior |
| Distribution | Published app navigation, audience visibility, comments, CSV/Excel data export, current-page PNG export, multi-page PDF and PowerPoint generation, fullscreen presentation mode with keyboard/page navigation, and persisted daily/weekly/monthly PDF or PowerPoint subscription schedules with preview, pause/resume, and recipient controls |
| Content governance | Editable owner and endorsement metadata plus administrator usage analytics for views, viewers, local pilot opens, and recent activity |

## Remaining front-end phases

None. The scoped front-end parity milestone is implemented. Subscription configuration and preview delivery are complete in the pilot front end; automatic unattended email execution remains part of the deferred production worker/hosting phase described in the delivery boundary.

## Acceptance rule

A feature is marked complete only when its control performs the behavior, its metadata persists when appropriate, and automated checks cover the critical path. Placeholder buttons are not counted as parity.
