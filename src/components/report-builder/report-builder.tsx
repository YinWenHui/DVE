"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import GridLayout, { type Layout } from "react-grid-layout";
import { Ban, BarChart3, Bookmark, Check, ChevronDown, ChevronUp, Clipboard, Contrast, Copy, CreditCard, Eye, EyeOff, Filter, ImageIcon, Layers3, LineChart, ListTree, MapPinned, Monitor, MousePointerClick, Navigation, Paintbrush, Plus, Redo2, RotateCcw, Save, ShieldCheck, SlidersHorizontal, Smartphone, Sparkles, Square, Table2, Trash2, Type, Undo2, WandSparkles } from "lucide-react";
import { ReportControl } from "@/components/report/report-control";
import { ReportVisual } from "@/components/report/report-visual";
import { createMobileLayout, nudgeLayoutItem, snapReportLayout } from "@/lib/report-authoring";
import { auditReportPage, contrastRatio } from "@/lib/report-accessibility";
import { defaultMatrixColumns, defaultTableColumns, resolvedMatrixRows, resolvedTabularColumns } from "@/lib/tabular";
import type { Aggregation, ConditionalFormattingOperator, ConditionalFormattingRule, Dataset, ManufacturingRecord, Report, ReportActionType, ReportBookmarkDefinition, ReportControlDefinition, ReportControlType, ReportFilterDefinition, ReportFormatPreset, ReportMobileLayoutItem, ReportPage, ReportPageCanvasOptions, ReportThemeDefinition, TabularColumnDefinition, VisualDefinition, VisualInteractionMode, VisualType } from "@/types";

const tools: Array<{ type: VisualType; label: string; icon: typeof BarChart3 }> = [
  { type: "kpi", label: "KPI card", icon: CreditCard },
  { type: "bar", label: "Bar chart", icon: BarChart3 },
  { type: "column", label: "Column chart", icon: BarChart3 },
  { type: "stackedBar", label: "Stacked bar", icon: Layers3 },
  { type: "stackedColumn", label: "Stacked column", icon: Layers3 },
  { type: "line", label: "Line chart", icon: LineChart },
  { type: "area", label: "Area chart", icon: LineChart },
  { type: "combo", label: "Line + column", icon: LineChart },
  { type: "scatter", label: "Scatter plot", icon: BarChart3 },
  { type: "map", label: "Map", icon: MapPinned },
  { type: "doughnut", label: "Doughnut", icon: BarChart3 },
  { type: "treemap", label: "Treemap", icon: Layers3 },
  { type: "funnel", label: "Funnel", icon: Layers3 },
  { type: "waterfall", label: "Waterfall", icon: BarChart3 },
  { type: "gauge", label: "Gauge", icon: CreditCard },
  { type: "table", label: "Table", icon: Table2 },
  { type: "matrix", label: "Matrix", icon: Table2 },
  { type: "slicer", label: "Slicer", icon: SlidersHorizontal },
];

type SettingsTab = "build" | "format" | "filters" | "selection" | "accessibility";
type CanvasMode = "desktop" | "mobile";

const defaultTheme: ReportThemeDefinition = {
  name: "Digital Verse",
  accentColor: "#5c73e6",
  secondaryColor: "#2fb3c2",
  canvasColor: "#eef2f8",
  surfaceColor: "#ffffff",
  textColor: "#172033",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
};

interface BuilderSnapshot {
  pages: ReportPage[];
  reportFilters: ReportFilterDefinition[];
  bookmarks: ReportBookmarkDefinition[];
  theme: ReportThemeDefinition;
  formatPresets: ReportFormatPreset[];
}

type BuilderClipboard =
  | { kind: "visual"; item: VisualDefinition }
  | { kind: "control"; item: ReportControlDefinition };

export function ReportBuilder({ datasets, records = [], initial }: { datasets: Dataset[]; records?: Record<string, unknown>[]; initial?: Report }) {
  const router = useRouter();
  const dataset = datasets.find((item) => item.id === initial?.datasetId) ?? datasets[0];
  const [name, setName] = useState(initial?.name ?? "Untitled report");
  const [slug, setSlug] = useState(initial?.slug ?? "untitled-report");
  const [description, setDescription] = useState(initial?.description ?? "Created with the Digital Verse report builder.");
  const [owner, setOwner] = useState(initial?.owner ?? "Manufacturing Intelligence");
  const [endorsement, setEndorsement] = useState<Report["endorsement"]>(initial?.endorsement);
  const [datasetId, setDatasetId] = useState(dataset?.id ?? "");
  const [pages, setPages] = useState<ReportPage[]>(() => structuredClone(initial?.pages ?? [{ id: crypto.randomUUID(), name: "Overview", ordinal: 0, visuals: [] }]));
  const [reportFilters, setReportFilters] = useState<ReportFilterDefinition[]>(() => structuredClone(initial?.filters ?? []));
  const [bookmarks, setBookmarks] = useState<ReportBookmarkDefinition[]>(() => structuredClone(initial?.bookmarks ?? []));
  const [theme, setTheme] = useState<ReportThemeDefinition>(() => structuredClone(initial?.theme ?? defaultTheme));
  const [formatPresets, setFormatPresets] = useState<ReportFormatPreset[]>(() => structuredClone(initial?.formatPresets ?? []));
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<string>();
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("build");
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("desktop");
  const [highContrastPreview, setHighContrastPreview] = useState(false);
  const [message, setMessage] = useState<string>();
  const [clientReady, setClientReady] = useState(false);
  const [clipboard, setClipboard] = useState<BuilderClipboard>();
  const [historyDepth, setHistoryDepth] = useState({ undo: 0, redo: 0 });
  const undoStack = useRef<BuilderSnapshot[]>([]);
  const redoStack = useRef<BuilderSnapshot[]>([]);
  const page = pages[pageIndex] ?? pages[0];
  const selected = page?.visuals.find((visual) => visual.id === selectedId);
  const selectedControl = page?.controls?.find((control) => control.id === selectedId);
  const selectedBookmark = bookmarks.find((bookmark) => bookmark.id === selectedBookmarkId);
  const selectedDataset = datasets.find((item) => item.id === datasetId);
  const dimensions = selectedDataset?.fields.filter((field) => !field.hidden && field.semanticType !== "measure") ?? [];
  const measures = selectedDataset?.fields.filter((field) => !field.hidden && field.semanticType === "measure") ?? [];
  const filterFields = selectedDataset?.fields.filter((field) => !field.hidden && field.filterable) ?? [];
  const previewRows = records as unknown as ManufacturingRecord[];

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setClientReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const desktopLayout = useMemo<Layout[]>(() => [
    ...(page?.visuals.filter((visual) => !visual.hidden).map((visual) => ({ i: visual.id, x: visual.x, y: visual.y, w: visual.w, h: visual.h, minW: 2, minH: 2 })) ?? []),
    ...(page?.controls?.filter((control) => !control.hidden).map((control) => ({ i: control.id, x: control.x, y: control.y, w: control.w, h: control.h, minW: 2, minH: 1 })) ?? []),
  ], [page]);
  const mobileLayout = useMemo<Layout[]>(() => {
    const configured = page?.mobileLayout?.enabled ? page.mobileLayout.items : undefined;
    if (!configured) return createMobileLayout(desktopLayout).map((item) => ({ ...item, minW: 1, minH: 1 }));
    const visibleIds = new Set(desktopLayout.map((item) => item.i));
    return configured.filter((item) => visibleIds.has(item.itemId) && !item.hidden).map((item) => ({ i: item.itemId, x: item.x, y: item.y, w: item.w, h: item.h, minW: 1, minH: 1 }));
  }, [desktopLayout, page]);
  const layout = canvasMode === "mobile" ? mobileLayout : desktopLayout;
  const builderVisibleIds = useMemo(() => new Set(layout.map((item) => item.i)), [layout]);
  const canUndo = historyDepth.undo > 0;
  const canRedo = historyDepth.redo > 0;

  const createSnapshot = useCallback((): BuilderSnapshot => structuredClone({ pages, reportFilters, bookmarks, theme, formatPresets }), [bookmarks, formatPresets, pages, reportFilters, theme]);

  const checkpoint = useCallback(() => {
    undoStack.current = [...undoStack.current.slice(-49), createSnapshot()];
    redoStack.current = [];
    setHistoryDepth({ undo: undoStack.current.length, redo: 0 });
  }, [createSnapshot]);

  const restoreSnapshot = useCallback((snapshot: BuilderSnapshot) => {
    setPages(structuredClone(snapshot.pages));
    setReportFilters(structuredClone(snapshot.reportFilters));
    setBookmarks(structuredClone(snapshot.bookmarks));
    setTheme(structuredClone(snapshot.theme));
    setFormatPresets(structuredClone(snapshot.formatPresets));
    setPageIndex((current) => Math.min(current, Math.max(0, snapshot.pages.length - 1)));
    setSelectedId(undefined);
    setSelectedBookmarkId(undefined);
  }, []);

  const undo = useCallback(() => {
    const previous = undoStack.current.at(-1);
    if (!previous) return;
    redoStack.current = [...redoStack.current.slice(-49), createSnapshot()];
    undoStack.current = undoStack.current.slice(0, -1);
    restoreSnapshot(previous);
    setHistoryDepth({ undo: undoStack.current.length, redo: redoStack.current.length });
  }, [createSnapshot, restoreSnapshot]);

  const redo = useCallback(() => {
    const next = redoStack.current.at(-1);
    if (!next) return;
    undoStack.current = [...undoStack.current.slice(-49), createSnapshot()];
    redoStack.current = redoStack.current.slice(0, -1);
    restoreSnapshot(next);
    setHistoryDepth({ undo: undoStack.current.length, redo: redoStack.current.length });
  }, [createSnapshot, restoreSnapshot]);

  function addVisual(type: VisualType) {
    if (!page) return;
    const id = crypto.randomUUID();
    const measure = measures[0]?.key as VisualDefinition["measure"];
    const secondaryMeasure = measures[1]?.key as VisualDefinition["secondaryMeasure"];
    const defaultDimension = type === "map" ? dimensions.find((field) => field.semanticType === "geographic" && field.dataType === "string") ?? dimensions[0] : dimensions[0];
    const dimension = defaultDimension?.key as VisualDefinition["dimension"];
    const nextY = page.visuals.reduce((maximum, visual) => Math.max(maximum, visual.y + visual.h), 0);
    const needsSecondary = ["stackedBar", "stackedColumn", "combo", "scatter"].includes(type);
    const supportsHierarchy = !["kpi", "gauge", "table", "matrix", "slicer", "scatter", "map"].includes(type);
    const compact = type === "kpi";
    const visual: VisualDefinition = {
      id,
      type,
      title: tools.find((item) => item.type === type)?.label ?? "Visual",
      x: 0,
      y: nextY,
      w: compact ? 3 : 6,
      h: compact ? 2 : 5,
      measure: ["table", "matrix", "slicer"].includes(type) ? undefined : measure,
      secondaryMeasure: needsSecondary ? secondaryMeasure : undefined,
      dimension: ["kpi", "gauge", "table", "matrix"].includes(type) ? undefined : dimension,
      hierarchy: supportsHierarchy && dimension ? [dimension] : [],
      aggregation: "sum",
      display: { showTitle: true, showLegend: ["doughnut", "treemap", "funnel", "combo", "stackedBar", "stackedColumn"].includes(type), showDataLabels: false, showGridlines: true, accentColor: theme.accentColor, backgroundColor: theme.surfaceColor, borderRadius: 10, titleAlignment: "left" },
      interaction: { crossFilter: true, tooltips: true },
      filters: [],
      tabular: type === "table" ? { columns: structuredClone(defaultTableColumns), rowLimit: 100, stripedRows: false, density: "standard" } : type === "matrix" ? { columns: structuredClone(defaultMatrixColumns), matrixRows: ["Line", "Model"], showTotals: true, stripedRows: false, density: "standard" } : undefined,
      geographic: type === "map" ? {
        locationField: dimension,
        latitudeField: dimensions.find((field) => field.key.toLocaleLowerCase().includes("latitude"))?.key as keyof ManufacturingRecord | undefined,
        longitudeField: dimensions.find((field) => field.key.toLocaleLowerCase().includes("longitude"))?.key as keyof ManufacturingRecord | undefined,
        mapName: "thailand",
      } : undefined,
    };
    updatePage({ ...page, visuals: [...page.visuals, visual] });
    setSelectedId(id);
    setSelectedBookmarkId(undefined);
    setSettingsTab("build");
  }

  function addControl(type: ReportControlType) {
    if (!page) return;
    const id = crypto.randomUUID();
    const nextY = [...page.visuals, ...(page.controls ?? [])].reduce((maximum, item) => Math.max(maximum, item.y + item.h), 0);
    const firstVisiblePage = pages.find((item) => !item.hidden) ?? pages[0];
    const objectType = ["textBox", "shape", "image"].includes(type);
    const title = type === "button" ? "Open page" : type === "pageNavigator" ? "Report pages" : type === "bookmarkNavigator" ? "Saved views" : type === "textBox" ? "Text box" : type === "shape" ? "Shape" : "Image";
    const control: ReportControlDefinition = {
      id,
      type,
      title,
      x: 0,
      y: nextY,
      w: type === "button" ? 3 : objectType ? 4 : 6,
      h: type === "textBox" ? 2 : type === "shape" || type === "image" ? 3 : 1,
      action: type === "button" ? { type: "page", targetId: firstVisiblePage?.id } : undefined,
      content: type === "textBox" ? "Add context or instructions for report viewers." : undefined,
      altText: type === "shape" ? "Decorative shape" : type === "image" ? "Report image" : undefined,
      display: { accentColor: theme.accentColor, backgroundColor: type === "shape" ? theme.accentColor : theme.surfaceColor, textColor: theme.textColor, borderColor: type === "shape" ? theme.accentColor : "#d8dfeb", borderWidth: 1, borderRadius: type === "shape" ? 12 : 9, fontSize: type === "textBox" ? 14 : undefined, fontWeight: type === "textBox" ? "normal" : undefined, textAlignment: "left", verticalAlignment: "center", shape: type === "shape" ? "roundedRectangle" : undefined, imageFit: type === "image" ? "contain" : undefined },
    };
    updatePage({ ...page, controls: [...(page.controls ?? []), control] });
    setSelectedId(id);
    setSelectedBookmarkId(undefined);
    setSettingsTab("build");
  }

  function updatePage(nextPage: ReportPage, recordHistory = true) {
    if (recordHistory) checkpoint();
    const validIds = new Set([...nextPage.visuals.map((visual) => visual.id), ...(nextPage.controls ?? []).map((control) => control.id)]);
    const normalizedPage = nextPage.mobileLayout ? { ...nextPage, mobileLayout: { ...nextPage.mobileLayout, items: nextPage.mobileLayout.items.filter((item) => validIds.has(item.itemId)) } } : nextPage;
    setPages((current) => current.map((item, index) => index === pageIndex ? normalizedPage : item));
  }

  function updateSelected(changes: Partial<VisualDefinition>) {
    if (!page || !selectedId) return;
    updatePage({ ...page, visuals: page.visuals.map((visual) => visual.id === selectedId ? { ...visual, ...changes } : visual) });
  }

  function updateSelectedControl(changes: Partial<ReportControlDefinition>) {
    if (!page || !selectedId) return;
    updatePage({ ...page, controls: (page.controls ?? []).map((control) => control.id === selectedId ? { ...control, ...changes } : control) });
  }

  function updateBookmark(changes: Partial<ReportBookmarkDefinition>) {
    if (!selectedBookmarkId) return;
    checkpoint();
    setBookmarks((current) => current.map((bookmark) => bookmark.id === selectedBookmarkId ? { ...bookmark, ...changes } : bookmark));
  }

  function addBookmark() {
    if (!page) return;
    const id = crypto.randomUUID();
    checkpoint();
    setBookmarks((current) => [...current, { id, name: `Bookmark ${current.length + 1}`, pageId: page.id, filters: {} }]);
    setSelectedBookmarkId(id);
    setSelectedId(undefined);
    setSettingsTab("build");
  }

  function updateDisplay(changes: NonNullable<VisualDefinition["display"]>) {
    if (!selected) return;
    updateSelected({ display: { ...selected.display, ...changes } });
  }

  function updateInteraction(changes: NonNullable<VisualDefinition["interaction"]>) {
    if (!selected) return;
    updateSelected({ interaction: { ...selected.interaction, ...changes } });
  }

  function updateVisualInteraction(sourceVisualId: string, targetVisualId: string, mode: VisualInteractionMode) {
    if (!page || sourceVisualId === targetVisualId) return;
    const remaining = (page.interactions ?? []).filter((interaction) => interaction.sourceVisualId !== sourceVisualId || interaction.targetVisualId !== targetVisualId);
    updatePage({ ...page, interactions: [...remaining, { sourceVisualId, targetVisualId, mode }] });
  }

  function changeLayout(next: Layout[]) {
    if (!page) return;
    if (canvasMode === "mobile") {
      const updatedIds = new Set(next.map((item) => item.i));
      const preserved = (page.mobileLayout?.items ?? []).filter((item) => !updatedIds.has(item.itemId));
      const items: ReportMobileLayoutItem[] = [...next.map((item) => ({ itemId: item.i, x: item.x, y: item.y, w: item.w, h: item.h })), ...preserved];
      const current = page.mobileLayout?.items ?? [];
      const changed = !page.mobileLayout?.enabled || JSON.stringify(current) !== JSON.stringify(items);
      if (changed) updatePage({ ...page, mobileLayout: { enabled: true, items } }, false);
      return;
    }
    const canvas = page.canvas ?? {};
    const normalized = snapReportLayout(next, canvas.snapToGrid !== false, canvas.gridSize ?? 1);
    let changed = false;
    const updatePositions = <T extends { id: string; x: number; y: number; w: number; h: number },>(items: T[]): T[] => items.map((item) => {
      const position = normalized.find((nextItem) => nextItem.i === item.id);
      if (!position || (item.x === position.x && item.y === position.y && item.w === position.w && item.h === position.h)) return item;
      changed = true;
      return { ...item, x: position.x, y: position.y, w: position.w, h: position.h };
    });
    const visuals = updatePositions(page.visuals);
    const controls = updatePositions(page.controls ?? []);
    if (changed) updatePage({ ...page, visuals, controls }, false);
  }

  function addPage() {
    const next: ReportPage = { id: crypto.randomUUID(), name: `Page ${pages.length + 1}`, ordinal: pages.length, visuals: [], filters: [], canvas: { backgroundColor: theme.canvasColor, showGrid: true, snapToGrid: true, gridSize: 1 } };
    checkpoint();
    setPages((current) => [...current, next]);
    setPageIndex(pages.length);
    setSelectedId(undefined);
    setSelectedBookmarkId(undefined);
  }

  function duplicatePage() {
    if (!page) return;
    const visualIds = new Map(page.visuals.map((visual) => [visual.id, crypto.randomUUID()]));
    const controlIds = new Map((page.controls ?? []).map((control) => [control.id, crypto.randomUUID()]));
    const next: ReportPage = {
      ...structuredClone(page),
      id: crypto.randomUUID(),
      name: `${page.name} copy`,
      ordinal: pages.length,
      visuals: page.visuals.map((visual) => ({ ...visual, id: visualIds.get(visual.id)! })),
      controls: page.controls?.map((control) => ({ ...control, id: controlIds.get(control.id)! })),
      mobileLayout: page.mobileLayout ? { ...page.mobileLayout, items: page.mobileLayout.items.flatMap((item) => { const itemId = visualIds.get(item.itemId) ?? controlIds.get(item.itemId); return itemId ? [{ ...item, itemId }] : []; }) } : undefined,
      interactions: page.interactions?.flatMap((interaction) => {
        const sourceVisualId = visualIds.get(interaction.sourceVisualId);
        const targetVisualId = visualIds.get(interaction.targetVisualId);
        return sourceVisualId && targetVisualId ? [{ ...interaction, sourceVisualId, targetVisualId }] : [];
      }),
    };
    checkpoint();
    setPages((current) => [...current, next]);
    setPageIndex(pages.length);
    setSelectedId(undefined);
    setSelectedBookmarkId(undefined);
  }

  function deletePage() {
    if (!page || pages.length === 1) return;
    const remaining = pages.filter((item) => item.id !== page.id);
    const fallbackPageId = remaining.find((item) => !item.hidden)?.id ?? remaining[0]?.id;
    const next = remaining.map((item, index) => ({
      ...item,
      ordinal: index,
      controls: item.controls?.map((control) => control.action?.type === "page" && control.action.targetId === page.id ? { ...control, action: { ...control.action, targetId: fallbackPageId } } : control),
    }));
    checkpoint();
    setPages(next);
    setBookmarks((current) => current.map((bookmark) => bookmark.pageId === page.id && fallbackPageId ? { ...bookmark, pageId: fallbackPageId } : bookmark));
    setPageIndex(Math.max(0, Math.min(pageIndex, next.length - 1)));
    setSelectedId(undefined);
    setSelectedBookmarkId(undefined);
  }

  function setDrillthroughTarget(enabled: boolean) {
    if (!page) return;
    const firstField = dimensions[0]?.key as keyof ManufacturingRecord | undefined;
    updatePage({ ...page, drillthrough: enabled && firstField ? { fields: [firstField], keepAllFilters: true } : undefined });
  }

  function setDrillthroughField(field: keyof ManufacturingRecord, enabled: boolean) {
    if (!page?.drillthrough) return;
    const fields = enabled
      ? [...new Set([...page.drillthrough.fields, field])]
      : page.drillthrough.fields.filter((item) => item !== field);
    if (!fields.length) return;
    updatePage({ ...page, drillthrough: { ...page.drillthrough, fields } });
  }

  function updateReportTheme(changes: Partial<ReportThemeDefinition>) {
    checkpoint();
    setTheme((current) => ({ ...current, ...changes }));
  }

  function updatePageCanvas(changes: Partial<ReportPageCanvasOptions>) {
    if (!page) return;
    updatePage({ ...page, canvas: { ...page.canvas, ...changes } });
  }

  function applyThemeToVisuals() {
    if (!page) return;
    updatePage({ ...page, visuals: page.visuals.map((visual) => ({ ...visual, display: { ...visual.display, accentColor: theme.accentColor, backgroundColor: theme.surfaceColor } })), controls: page.controls?.map((control) => ({ ...control, display: { ...control.display, accentColor: theme.accentColor, backgroundColor: theme.surfaceColor, textColor: theme.textColor } })) });
    setMessage(`Applied ${theme.name} to ${page.name}.`);
  }

  function saveFormatPreset(presetName: string) {
    if (!selected || !presetName.trim()) return;
    checkpoint();
    setFormatPresets((current) => [...current, { id: crypto.randomUUID(), name: presetName.trim(), display: structuredClone(selected.display ?? {}) }]);
  }

  function deleteFormatPreset(id: string) {
    checkpoint();
    setFormatPresets((current) => current.filter((preset) => preset.id !== id));
  }

  function copySelection() {
    if (selected) setClipboard({ kind: "visual", item: structuredClone(selected) });
    else if (selectedControl) setClipboard({ kind: "control", item: structuredClone(selectedControl) });
  }

  function pasteSelection() {
    if (!page || !clipboard) return;
    const id = crypto.randomUUID();
    const snapPlacement = (item: { x: number; y: number; w: number; h: number }) => snapReportLayout([{ i: id, x: Math.min(10, item.x + 1), y: item.y + 1, w: item.w, h: item.h }], page.canvas?.snapToGrid !== false, page.canvas?.gridSize ?? 1)[0]!;
    if (clipboard.kind === "visual") {
      const placement = snapPlacement(clipboard.item);
      const item = { ...structuredClone(clipboard.item), id, title: `${clipboard.item.title} copy`, x: placement.x, y: placement.y, w: placement.w, h: placement.h, hidden: false };
      updatePage({ ...page, visuals: [...page.visuals, item] });
    } else {
      const placement = snapPlacement(clipboard.item);
      const item = { ...structuredClone(clipboard.item), id, title: `${clipboard.item.title} copy`, x: placement.x, y: placement.y, w: placement.w, h: placement.h, hidden: false };
      updatePage({ ...page, controls: [...(page.controls ?? []), item] });
    }
    setSelectedId(id);
    setSelectedBookmarkId(undefined);
  }

  function deleteBookmark(id: string) {
    checkpoint();
    setBookmarks((current) => current.filter((bookmark) => bookmark.id !== id));
    setPages((current) => current.map((item) => ({ ...item, controls: item.controls?.map((control) => control.action?.type === "bookmark" && control.action.targetId === id ? { ...control, action: { type: "resetFilters" } } : control) })));
    setSelectedBookmarkId(undefined);
  }

  function updateItemVisibility(id: string, hidden: boolean) {
    if (!page) return;
    updatePage({ ...page, visuals: page.visuals.map((visual) => visual.id === id ? { ...visual, hidden } : visual), controls: page.controls?.map((control) => control.id === id ? { ...control, hidden } : control) });
  }

  function resetMobileLayout() {
    if (!page) return;
    const items = createMobileLayout(desktopLayout).map((item) => ({ itemId: item.i, x: item.x, y: item.y, w: item.w, h: item.h }));
    updatePage({ ...page, mobileLayout: { enabled: true, items } });
  }

  function updateMobileVisibility(id: string, hidden: boolean) {
    if (!page) return;
    const base: ReportMobileLayoutItem[] = page.mobileLayout?.enabled ? page.mobileLayout.items : createMobileLayout(desktopLayout).map((item) => ({ itemId: item.i, x: item.x, y: item.y, w: item.w, h: item.h }));
    const exists = base.some((item) => item.itemId === id);
    const items = exists ? base.map((item) => item.itemId === id ? { ...item, hidden } : item) : [...base, { itemId: id, x: 0, y: Math.max(0, ...base.map((item) => item.y + item.h)), w: 2, h: 2, hidden }];
    updatePage({ ...page, mobileLayout: { enabled: true, items } });
  }

  function moveItem(id: string, direction: -1 | 1) {
    if (!page) return;
    const reorder = <T extends { id: string }>(items: T[]): T[] => {
      const index = items.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= items.length) return items;
      const next = [...items];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    };
    updatePage({ ...page, visuals: reorder(page.visuals), controls: reorder(page.controls ?? []) });
  }

  function nudgeSelection(key: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown", resize: boolean) {
    if (!page || !selectedId) return;
    if (canvasMode === "mobile") {
      const base: ReportMobileLayoutItem[] = page.mobileLayout?.enabled ? page.mobileLayout.items : createMobileLayout(desktopLayout).map((item) => ({ itemId: item.i, x: item.x, y: item.y, w: item.w, h: item.h }));
      const items = base.map((item) => item.itemId === selectedId ? { ...nudgeLayoutItem({ i: item.itemId, x: item.x, y: item.y, w: item.w, h: item.h }, key, resize, 2), itemId: item.itemId, hidden: item.hidden } : item);
      updatePage({ ...page, mobileLayout: { enabled: true, items } });
      return;
    }
    const update = <T extends { id: string; x: number; y: number; w: number; h: number },>(items: T[]) => items.map((item) => item.id === selectedId ? (() => { const next = nudgeLayoutItem({ i: item.id, x: item.x, y: item.y, w: item.w, h: item.h }, key, resize, 12); return { ...item, x: next.x, y: next.y, w: next.w, h: next.h }; })() : item);
    updatePage({ ...page, visuals: update(page.visuals), controls: update(page.controls ?? []) });
  }

  function deleteSelection() {
    if (!page || !selectedId) return;
    const visualExists = page.visuals.some((visual) => visual.id === selectedId);
    const controlExists = page.controls?.some((control) => control.id === selectedId);
    if (!visualExists && !controlExists) return;
    updatePage({ ...page, visuals: page.visuals.filter((visual) => visual.id !== selectedId), controls: page.controls?.filter((control) => control.id !== selectedId), interactions: page.interactions?.filter((interaction) => interaction.sourceVisualId !== selectedId && interaction.targetVisualId !== selectedId), mobileLayout: page.mobileLayout ? { ...page.mobileLayout, items: page.mobileLayout.items.filter((item) => item.itemId !== selectedId) } : undefined });
    setSelectedId(undefined);
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const key = event.key.toLocaleLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key) && selectedId) { event.preventDefault(); nudgeSelection((`Arrow${key.slice(5, 6).toUpperCase()}${key.slice(6)}`) as "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown", event.shiftKey); return; }
      if (!(event.ctrlKey || event.metaKey)) return;
      if (key === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      else if (key === "y") { event.preventDefault(); redo(); }
      else if (key === "c") { event.preventDefault(); copySelection(); }
      else if (key === "v") { event.preventDefault(); pasteSelection(); }
    };
    const handleDelete = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) { event.preventDefault(); deleteSelection(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keydown", handleDelete);
    return () => { window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("keydown", handleDelete); };
  });

  async function save(status: Report["status"] = initial?.status ?? "draft") {
    const body = { name, slug, datasetId, description, owner, endorsement, status, filters: reportFilters, bookmarks, theme, formatPresets, pages };
    const response = await fetch(initial ? `/api/reports/${initial.id}` : "/api/reports", { method: initial ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json() as { report?: Report; error?: { message?: string } };
    setMessage(response.ok ? `Report ${status === "published" ? "published" : "saved"}.` : payload.error?.message ?? "Save failed.");
    if (response.ok && !initial && payload.report) router.push(`/admin/reports/${payload.report.id}/edit`);
  }

  return <>
    <div className="panel builder-report-settings" data-client-ready={clientReady}><div className="form-grid"><label>Report name<input value={name} onChange={(event) => { setName(event.target.value); if (!initial) setSlug(event.target.value.toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "")); }} /></label><label>Slug<input value={slug} onChange={(event) => setSlug(event.target.value)} /></label><label>Dataset<select value={datasetId} onChange={(event) => setDatasetId(event.target.value)}>{datasets.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Description<input value={description} onChange={(event) => setDescription(event.target.value)} /></label><label>Owner<input value={owner} onChange={(event) => setOwner(event.target.value)} /></label><label>Endorsement<select value={endorsement ?? ""} onChange={(event) => setEndorsement(event.target.value ? event.target.value as NonNullable<Report["endorsement"]> : undefined)}><option value="">None</option><option value="promoted">Promoted</option><option value="certified">Certified</option></select></label><div className="table-actions full"><button className="button" onClick={() => save("draft")}><Save size={15} /> Save draft</button><button className="button primary" onClick={() => save("published")}>Publish report</button></div></div>{message && <p className="status-banner" style={{ marginTop: 12 }}>{message}</p>}</div>
    <div className="builder-shell">
      <aside className="builder-pane builder-left-pane">
        <div className="panel-header"><div><h3>Visualizations</h3><p>Choose a visual</p></div></div>
        <div className="builder-visual-catalog">{tools.map(({ type, label, icon: Icon }) => <button title={label} aria-label={`Add ${label}`} key={type} onClick={() => addVisual(type)}><Icon size={16} /><span>{label}</span></button>)}</div>
        <div className="panel-header builder-section-heading"><div><h3>Insert controls</h3><p>Buttons and navigators</p></div></div>
        <div className="builder-visual-catalog builder-control-catalog">
          <button aria-label="Add Button" onClick={() => addControl("button")}><MousePointerClick size={16} /><span>Button</span></button>
          <button aria-label="Add Page navigator" onClick={() => addControl("pageNavigator")}><Navigation size={16} /><span>Page nav</span></button>
          <button aria-label="Add Bookmark navigator" onClick={() => addControl("bookmarkNavigator")}><Bookmark size={16} /><span>Bookmark nav</span></button>
          <button aria-label="Add Text box" onClick={() => addControl("textBox")}><Type size={16} /><span>Text box</span></button>
          <button aria-label="Add Shape" onClick={() => addControl("shape")}><Square size={16} /><span>Shape</span></button>
          <button aria-label="Add Image" onClick={() => addControl("image")}><ImageIcon size={16} /><span>Image</span></button>
        </div>
        <div className="panel-header builder-section-heading"><div><h3>Data</h3><p>{selectedDataset?.name}</p></div></div>
        <div className="builder-field-list">{selectedDataset?.fields.filter((field) => !field.hidden).map((field) => <div key={field.id}><span>{field.semanticType === "measure" ? "∑" : field.semanticType === "date" ? "▣" : "▦"}</span><strong>{field.displayName}</strong><small>{field.dataType}</small></div>)}</div>
        <div className="panel-header builder-section-heading"><div><h3>Pages</h3><p>{pages.length} report pages</p></div><button className="icon-button" onClick={addPage} aria-label="Add page"><Plus size={14} /></button></div>
        <div className="builder-tool-list">{pages.map((item, index) => <button className={`builder-tool ${index === pageIndex ? "active" : ""}`} aria-label={`Edit page ${item.name}`} key={item.id} onClick={() => { setPageIndex(index); setSelectedId(undefined); setSelectedBookmarkId(undefined); }}><span>{item.hidden ? <EyeOff size={13} /> : <Eye size={13} />}</span>{item.name}</button>)}</div>
        {page && <div className="form-stack page-settings"><label>Page name<input value={page.name} onChange={(event) => updatePage({ ...page, name: event.target.value })} /></label><div className="table-actions"><button className="icon-button" title="Duplicate page" onClick={duplicatePage}><Copy size={14} /></button><button className="icon-button" title={page.hidden ? "Show page" : "Hide page"} onClick={() => updatePage({ ...page, hidden: !page.hidden })}>{page.hidden ? <Eye size={14} /> : <EyeOff size={14} />}</button><button className="icon-button danger" title="Delete page" disabled={pages.length === 1} onClick={deletePage}><Trash2 size={14} /></button></div></div>}
        {page && <div className="page-drillthrough-settings">
          <label className="toggle-row"><span>Drillthrough target</span><input aria-label="Use page as drillthrough target" type="checkbox" checked={Boolean(page.drillthrough)} onChange={(event) => setDrillthroughTarget(event.target.checked)} /></label>
          {page.drillthrough && <><p>Fields accepted from source visuals</p><div className="page-drillthrough-fields">{dimensions.map((field) => { const checked = page.drillthrough?.fields.includes(field.key as keyof ManufacturingRecord) ?? false; return <label key={field.id}><input type="checkbox" aria-label={`Drillthrough field ${field.displayName}`} checked={checked} disabled={checked && page.drillthrough?.fields.length === 1} onChange={(event) => setDrillthroughField(field.key as keyof ManufacturingRecord, event.target.checked)} /> {field.displayName}</label>; })}</div><label className="toggle-row"><span>Keep all filters</span><input aria-label="Keep all drillthrough filters" type="checkbox" checked={page.drillthrough.keepAllFilters !== false} onChange={(event) => updatePage({ ...page, drillthrough: { ...page.drillthrough!, keepAllFilters: event.target.checked } })} /></label></>}
        </div>}
        <div className="panel-header builder-section-heading"><div><h3>Report bookmarks</h3><p>{bookmarks.length} published views</p></div><button className="icon-button" onClick={addBookmark} aria-label="Add report bookmark"><Plus size={14} /></button></div>
        <div className="builder-tool-list">{bookmarks.map((bookmark) => <button className={`builder-tool ${bookmark.id === selectedBookmarkId ? "active" : ""}`} key={bookmark.id} onClick={() => { setSelectedBookmarkId(bookmark.id); setSelectedId(undefined); setSettingsTab("build"); }}><Bookmark size={13} />{bookmark.name}</button>)}{!bookmarks.length && <p className="muted filter-empty">Add a shared view for buttons and bookmark navigators.</p>}</div>
      </aside>
      <section className={`builder-canvas canvas-${canvasMode}`}>
        <div className="builder-canvas-label"><span>{canvasMode === "mobile" ? "Mobile canvas" : "Desktop canvas"}</span><div className="builder-canvas-toolbar" role="toolbar" aria-label="Canvas editing"><button className={`icon-button ${canvasMode === "desktop" ? "active" : ""}`} aria-label="Desktop layout" aria-pressed={canvasMode === "desktop"} onClick={() => setCanvasMode("desktop")}><Monitor size={14} /></button><button className={`icon-button ${canvasMode === "mobile" ? "active" : ""}`} aria-label="Mobile layout" aria-pressed={canvasMode === "mobile"} onClick={() => setCanvasMode("mobile")}><Smartphone size={14} /></button>{canvasMode === "mobile" && <button className="icon-button" aria-label="Auto arrange mobile layout" title="Auto arrange mobile layout" onClick={resetMobileLayout}><WandSparkles size={14} /></button>}<button className={`icon-button ${highContrastPreview ? "active" : ""}`} aria-label="High contrast preview" aria-pressed={highContrastPreview} onClick={() => setHighContrastPreview((current) => !current)}><Contrast size={14} /></button><button className="icon-button" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}><Undo2 size={14} /></button><button className="icon-button" aria-label="Redo" title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={redo}><Redo2 size={14} /></button><button className="icon-button" aria-label="Copy selected item" title="Copy (Ctrl+C)" disabled={!selected && !selectedControl} onClick={copySelection}><Copy size={14} /></button><button className="icon-button" aria-label="Paste copied item" title="Paste (Ctrl+V)" disabled={!clipboard} onClick={pasteSelection}><Clipboard size={14} /></button><small>Arrow keys move · Shift + arrows resize</small></div></div>
        <div className={`builder-grid-stage ${canvasMode === "mobile" ? "mobile" : ""}`} data-show-grid={page?.canvas?.showGrid !== false} data-high-contrast={highContrastPreview} style={builderCanvasStyle(page, theme)}>
          <GridLayout layout={layout} cols={canvasMode === "mobile" ? 2 : 12} rowHeight={canvasMode === "mobile" ? 68 : 54} width={canvasMode === "mobile" ? 360 : 900} margin={[8, 8]} onLayoutChange={changeLayout} onDragStart={checkpoint} onResizeStart={checkpoint} draggableHandle=".builder-visual-handle">
            {page?.visuals.filter((visual) => !visual.hidden && builderVisibleIds.has(visual.id)).map((visual) => <div key={visual.id} onClick={() => { setSelectedId(visual.id); setSelectedBookmarkId(undefined); }}><div className={`builder-preview ${selectedId === visual.id ? "selected" : ""}`}><button className="builder-visual-handle" aria-label={`Move ${visual.title}`}>{visual.title}</button><div className="builder-preview-body"><ReportVisual visual={visual} rows={previewRows} showActions={false} /></div></div></div>)}
            {page?.controls?.filter((control) => !control.hidden && builderVisibleIds.has(control.id)).map((control) => <div key={control.id} onClick={() => { setSelectedId(control.id); setSelectedBookmarkId(undefined); }}><div className={`builder-preview ${selectedId === control.id ? "selected" : ""}`}><button className="builder-visual-handle" aria-label={`Move ${control.title}`}>{control.title}</button><div className="builder-preview-body"><ReportControl control={control} pages={pages} bookmarks={bookmarks} activePageId={page.id} /></div></div></div>)}
          </GridLayout>
        </div>
        {!page?.visuals.length && !page?.controls?.length && <div className="empty-state">Add a visual or navigation control from the left pane, then drag and resize it on this canvas.</div>}
      </section>
      <aside className="builder-pane builder-settings-pane">
        <div className="builder-settings-tabs"><button className={settingsTab === "build" ? "active" : ""} onClick={() => setSettingsTab("build")}><Layers3 size={14} /> Build</button><button className={settingsTab === "format" ? "active" : ""} onClick={() => setSettingsTab("format")}><Paintbrush size={14} /> Format</button><button className={settingsTab === "filters" ? "active" : ""} onClick={() => setSettingsTab("filters")}><SlidersHorizontal size={14} /> Filters</button><button className={settingsTab === "selection" ? "active" : ""} onClick={() => setSettingsTab("selection")}><ListTree size={14} /> Selection</button><button className={settingsTab === "accessibility" ? "active" : ""} onClick={() => setSettingsTab("accessibility")}><ShieldCheck size={14} /> Inspect</button></div>
        {settingsTab === "build" && (selected ? <BuildSettings selected={selected} dimensions={dimensions} measures={measures} updateSelected={updateSelected} onDelete={() => { if (!page) return; updatePage({ ...page, visuals: page.visuals.filter((visual) => visual.id !== selected.id), interactions: page.interactions?.filter((interaction) => interaction.sourceVisualId !== selected.id && interaction.targetVisualId !== selected.id) }); setSelectedId(undefined); }} /> : selectedControl ? <ControlBuildSettings selected={selectedControl} pages={pages} bookmarks={bookmarks} updateSelected={updateSelectedControl} onDelete={() => { if (!page) return; updatePage({ ...page, controls: (page.controls ?? []).filter((control) => control.id !== selectedControl.id) }); setSelectedId(undefined); }} /> : selectedBookmark ? <BookmarkSettings selected={selectedBookmark} pages={pages} rows={previewRows} updateSelected={updateBookmark} onDelete={() => deleteBookmark(selectedBookmark.id)} /> : <div className="empty-state compact">Select a visual, control, or report bookmark to configure it.</div>)}
        {settingsTab === "format" && <div className="builder-format-stack"><ReportFormatSettings theme={theme} page={page} updateTheme={updateReportTheme} updateCanvas={updatePageCanvas} applyTheme={applyThemeToVisuals} />{selected ? <FormatSettings selected={selected} page={page} measures={measures} presets={formatPresets} updateSelected={updateSelected} updateDisplay={updateDisplay} updateInteraction={updateInteraction} updateVisualInteraction={updateVisualInteraction} savePreset={saveFormatPreset} deletePreset={deleteFormatPreset} /> : selectedControl ? <ControlFormatSettings selected={selectedControl} updateSelected={updateSelectedControl} /> : <p className="muted filter-empty">Select a visual or control for item formatting. Report and page styling remains available above.</p>}</div>}
        {settingsTab === "filters" && <div className="builder-filter-scopes">{selected && <FilterEditor title="Filters on this visual" filters={selected.filters ?? []} fields={filterFields} onChange={(filters) => updateSelected({ filters })} />}<FilterEditor title="Filters on this page" filters={page?.filters ?? []} fields={filterFields} onChange={(filters) => page && updatePage({ ...page, filters })} /><FilterEditor title="Filters on all pages" filters={reportFilters} fields={filterFields} onChange={(filters) => { checkpoint(); setReportFilters(filters); }} /></div>}
        {settingsTab === "selection" && page && <SelectionPane page={page} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setSelectedBookmarkId(undefined); }} onVisibility={updateItemVisibility} onMobileVisibility={updateMobileVisibility} onMove={moveItem} />}
        {settingsTab === "accessibility" && page && <AccessibilityPane page={page} theme={theme} onSelect={(id) => { setSelectedId(id); setSelectedBookmarkId(undefined); }} highContrast={highContrastPreview} onToggleHighContrast={() => setHighContrastPreview((current) => !current)} />}
      </aside>
    </div>
  </>;
}

function builderCanvasStyle(page: ReportPage | undefined, theme: ReportThemeDefinition): CSSProperties {
  const canvas = page?.canvas ?? {};
  const wallpaper = canvas.wallpaperUrl?.trim();
  return {
    backgroundColor: canvas.backgroundColor ?? theme.canvasColor,
    backgroundImage: wallpaper ? `url(${JSON.stringify(wallpaper)})` : undefined,
    backgroundPosition: "center",
    backgroundRepeat: canvas.wallpaperFit === "contain" ? "no-repeat" : undefined,
    backgroundSize: canvas.wallpaperFit === "fill" ? "100% 100%" : canvas.wallpaperFit ?? "cover",
    "--accent": theme.accentColor,
    "--surface": theme.surfaceColor,
    "--text": theme.textColor,
    fontFamily: theme.fontFamily,
  } as CSSProperties;
}

function BuildSettings({ selected, dimensions, measures, updateSelected, onDelete }: { selected: VisualDefinition; dimensions: Dataset["fields"]; measures: Dataset["fields"]; updateSelected: (changes: Partial<VisualDefinition>) => void; onDelete: () => void }) {
  const valueFields = (selected.valueFields?.length ? selected.valueFields : [selected.measure, selected.secondaryMeasure])
    .filter((field): field is keyof ManufacturingRecord => Boolean(field))
    .filter((field, index, fields) => fields.indexOf(field) === index);
  const supportsHierarchy = Boolean(selected.dimension && valueFields.length && !["gauge", "scatter", "slicer", "kpi", "table", "matrix"].includes(selected.type));
  const hierarchy = (selected.categoryFields?.length ? selected.categoryFields : [selected.dimension, ...(selected.hierarchy ?? [])])
    .filter((field): field is keyof ManufacturingRecord => Boolean(field))
    .filter((field, index, fields) => fields.indexOf(field) === index);
  const updateCategoryFields = (next: Array<keyof ManufacturingRecord>) => updateSelected({ dimension: next[0], hierarchy: next, categoryFields: next });
  const updateValueFields = (next: Array<keyof ManufacturingRecord>) => updateSelected({ measure: next[0], secondaryMeasure: next[1], valueFields: next });
  const updateDimension = (value: string) => {
    const dimension = value as VisualDefinition["dimension"] || undefined;
    const remaining = hierarchy.filter((field) => field !== dimension && field !== selected.dimension);
    updateCategoryFields(dimension ? [dimension, ...remaining] : []);
  };
  const updateHierarchyLevel = (index: number, value: string) => {
    const next = [...hierarchy];
    if (value) next[index] = value as keyof ManufacturingRecord;
    else next.splice(index);
    const unique = next.filter((field, fieldIndex, fields) => fields.indexOf(field) === fieldIndex);
    updateCategoryFields(unique);
  };
  const moveField = (fields: Array<keyof ManufacturingRecord>, index: number, direction: -1 | 1, update: (next: Array<keyof ManufacturingRecord>) => void) => { const target = index + direction; if (target < 0 || target >= fields.length) return; const next = [...fields]; [next[index], next[target]] = [next[target]!, next[index]!]; update(next); };
  const tooltipFields = selected.tooltipFields ?? [];
  const allFields = [...dimensions, ...measures];
  const addValueField = () => { const field = measures.find((item) => !valueFields.includes(item.key as keyof ManufacturingRecord)); if (field) updateValueFields([...valueFields, field.key as keyof ManufacturingRecord]); };
  const addTooltipField = () => { const field = allFields.find((item) => !tooltipFields.includes(item.key as keyof ManufacturingRecord)); if (field) updateSelected({ tooltipFields: [...tooltipFields, field.key as keyof ManufacturingRecord] }); };
  const isTabular = selected.type === "table" || selected.type === "matrix";
  const isMap = selected.type === "map";
  return <div className="form-stack">
    <div className="panel-header"><div><h3>Build visual</h3><p>{tools.find((item) => item.type === selected.type)?.label}</p></div><button className="icon-button danger" aria-label="Delete visual" onClick={onDelete}><Trash2 size={14} /></button></div>
    <label>Title<input value={selected.title} onChange={(event) => updateSelected({ title: event.target.value })} /></label>
    <label>Visual type<select value={selected.type} onChange={(event) => updateSelected({ type: event.target.value as VisualType })}>{tools.map((item) => <option value={item.type} key={item.type}>{item.label}</option>)}</select></label>
    {isTabular ? <TabularBuildSettings selected={selected} fields={allFields} dimensions={dimensions} updateSelected={updateSelected} /> : isMap ? <MapBuildSettings selected={selected} dimensions={dimensions} measures={measures} updateSelected={updateSelected} /> : <><label>Category / X-axis<select value={selected.dimension ?? ""} onChange={(event) => updateDimension(event.target.value)}><option value="">None</option>{dimensions.map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select></label>
    {supportsHierarchy && <div className="settings-group hierarchy-settings"><strong>Drill hierarchy</strong><p>Click a category to drill when drill mode is active.</p>
      <label>Drill level 2<select value={hierarchy[1] ?? ""} disabled={!selected.dimension} onChange={(event) => updateHierarchyLevel(1, event.target.value)}><option value="">None</option>{dimensions.filter((field) => field.key !== selected.dimension).map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select></label>
      <label>Drill level 3<select value={hierarchy[2] ?? ""} disabled={hierarchy.length < 2} onChange={(event) => updateHierarchyLevel(2, event.target.value)}><option value="">None</option>{dimensions.filter((field) => !hierarchy.slice(0, 2).includes(field.key as keyof ManufacturingRecord)).map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select></label>
      <div className="field-well-list">{hierarchy.map((field, index) => <div className="field-well-row" key={field}><span>{String(field)}</span><button type="button" aria-label={`Move category ${String(field)} up`} disabled={index === 0} onClick={() => moveField(hierarchy, index, -1, updateCategoryFields)}><ChevronUp size={11} /></button><button type="button" aria-label={`Move category ${String(field)} down`} disabled={index === hierarchy.length - 1} onClick={() => moveField(hierarchy, index, 1, updateCategoryFields)}><ChevronDown size={11} /></button></div>)}</div>
    </div>}
    <div className="settings-group"><div className="field-well-heading"><strong>Value fields</strong><button className="icon-button" type="button" aria-label="Add value field" disabled={valueFields.length >= measures.length || valueFields.length >= 4} onClick={addValueField}><Plus size={12} /></button></div><div className="field-well-list">{valueFields.map((field, index) => <div className="field-well-row field-well-select-row" key={`${field}-${index}`}><select aria-label={`Value field ${index + 1}`} value={field} onChange={(event) => updateValueFields(valueFields.map((item, itemIndex) => itemIndex === index ? event.target.value as keyof ManufacturingRecord : item))}>{measures.filter((item) => item.key === field || !valueFields.includes(item.key as keyof ManufacturingRecord)).map((item) => <option value={item.key} key={item.id}>{item.displayName}</option>)}</select><button type="button" aria-label={`Move value ${String(field)} up`} disabled={index === 0} onClick={() => moveField(valueFields, index, -1, updateValueFields)}><ChevronUp size={11} /></button><button type="button" aria-label={`Move value ${String(field)} down`} disabled={index === valueFields.length - 1} onClick={() => moveField(valueFields, index, 1, updateValueFields)}><ChevronDown size={11} /></button><button type="button" aria-label={`Remove value ${String(field)}`} disabled={valueFields.length === 1} onClick={() => updateValueFields(valueFields.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={11} /></button></div>)}</div></div>
    <div className="settings-group"><strong>Series and layout</strong><label>Legend field<select aria-label="Legend field" value={selected.legendField ?? ""} onChange={(event) => updateSelected({ legendField: event.target.value as keyof ManufacturingRecord || undefined })}><option value="">None</option>{dimensions.map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select></label><label>Small multiples<select aria-label="Small multiple field" value={selected.smallMultipleField ?? ""} onChange={(event) => updateSelected({ smallMultipleField: event.target.value as keyof ManufacturingRecord || undefined })}><option value="">None</option>{dimensions.filter((field) => field.key !== selected.dimension).map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select></label></div>
    <div className="settings-group"><div className="field-well-heading"><strong>Tooltip fields</strong><button className="icon-button" type="button" aria-label="Add tooltip field" disabled={tooltipFields.length >= allFields.length || tooltipFields.length >= 6} onClick={addTooltipField}><Plus size={12} /></button></div><div className="field-well-list">{tooltipFields.map((field, index) => <div className="field-well-row field-well-select-row" key={`${field}-${index}`}><select aria-label={`Tooltip field ${index + 1}`} value={field} onChange={(event) => updateSelected({ tooltipFields: tooltipFields.map((item, itemIndex) => itemIndex === index ? event.target.value as keyof ManufacturingRecord : item) })}>{allFields.filter((item) => item.key === field || !tooltipFields.includes(item.key as keyof ManufacturingRecord)).map((item) => <option value={item.key} key={item.id}>{item.displayName}</option>)}</select><button type="button" aria-label={`Move tooltip ${String(field)} up`} disabled={index === 0} onClick={() => moveField(tooltipFields, index, -1, (next) => updateSelected({ tooltipFields: next }))}><ChevronUp size={11} /></button><button type="button" aria-label={`Move tooltip ${String(field)} down`} disabled={index === tooltipFields.length - 1} onClick={() => moveField(tooltipFields, index, 1, (next) => updateSelected({ tooltipFields: next }))}><ChevronDown size={11} /></button><button type="button" aria-label={`Remove tooltip ${String(field)}`} onClick={() => updateSelected({ tooltipFields: tooltipFields.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={11} /></button></div>)}</div>{!tooltipFields.length && <p className="muted filter-empty">No additional tooltip fields.</p>}</div>
    <label>Aggregation<select value={selected.aggregation ?? "sum"} onChange={(event) => updateSelected({ aggregation: event.target.value as Aggregation })}>{["sum", "average", "minimum", "maximum", "count", "distinctCount"].map((value) => <option key={value}>{value}</option>)}</select></label>
    <label>Number format<select value={selected.format ?? "number"} onChange={(event) => updateSelected({ format: event.target.value as VisualDefinition["format"] })}><option value="number">Number</option><option value="percent">Percentage</option></select></label>
    <div className="settings-group"><strong>Sort</strong><label>Sort by<select aria-label="Sort visual by" value={selected.sort?.field ?? ""} onChange={(event) => updateSelected({ sort: event.target.value ? { field: event.target.value as keyof ManufacturingRecord, direction: selected.sort?.direction ?? "asc" } : undefined })}><option value="">Default order</option>{[...dimensions, ...measures].map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select></label><label>Direction<select aria-label="Sort visual direction" value={selected.sort?.direction ?? "asc"} disabled={!selected.sort} onChange={(event) => selected.sort && updateSelected({ sort: { ...selected.sort, direction: event.target.value as "asc" | "desc" } })}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label></div></>}
    {selected.type === "kpi" && <KpiTargetSettings selected={selected} measures={measures} updateSelected={updateSelected} />}
  </div>;
}

function MapBuildSettings({ selected, dimensions, measures, updateSelected }: { selected: VisualDefinition; dimensions: Dataset["fields"]; measures: Dataset["fields"]; updateSelected: (changes: Partial<VisualDefinition>) => void }) {
  const geographic = selected.geographic ?? { mapName: "thailand" as const };
  const locations = dimensions.filter((field) => field.dataType === "string");
  const coordinates = dimensions.filter((field) => field.dataType === "decimal" || field.dataType === "integer");
  const changeGeographic = (changes: NonNullable<VisualDefinition["geographic"]>) => updateSelected({ geographic: { ...geographic, ...changes, mapName: "thailand" } });
  return <div className="form-stack map-build-settings">
    <div className="settings-group"><strong>Offline geography</strong><p>Uses the bundled Thailand boundary. No coordinates or report data leave this browser.</p>
      <label>Location<select aria-label="Map location field" value={geographic.locationField ?? selected.dimension ?? ""} onChange={(event) => { const locationField = event.target.value as keyof ManufacturingRecord; updateSelected({ dimension: locationField, geographic: { ...geographic, locationField, mapName: "thailand" } }); }}><option value="">None</option>{locations.map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select></label>
      <label>Latitude<select aria-label="Map latitude field" value={geographic.latitudeField ?? ""} onChange={(event) => changeGeographic({ latitudeField: event.target.value as keyof ManufacturingRecord || undefined })}><option value="">None</option>{coordinates.map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select></label>
      <label>Longitude<select aria-label="Map longitude field" value={geographic.longitudeField ?? ""} onChange={(event) => changeGeographic({ longitudeField: event.target.value as keyof ManufacturingRecord || undefined })}><option value="">None</option>{coordinates.map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select></label>
    </div>
    <label>Marker size<select aria-label="Map value field" value={selected.measure ?? ""} onChange={(event) => updateSelected({ measure: event.target.value as keyof ManufacturingRecord || undefined, valueFields: event.target.value ? [event.target.value as keyof ManufacturingRecord] : [] })}><option value="">Count of locations</option>{measures.map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select></label>
    <label>Aggregation<select aria-label="Map aggregation" value={selected.aggregation ?? "sum"} onChange={(event) => updateSelected({ aggregation: event.target.value as Aggregation })}>{["sum", "average", "minimum", "maximum", "count", "distinctCount"].map((value) => <option key={value}>{value}</option>)}</select></label>
  </div>;
}

function KpiTargetSettings({ selected, measures, updateSelected }: { selected: VisualDefinition; measures: Dataset["fields"]; updateSelected: (changes: Partial<VisualDefinition>) => void }) {
  const target = selected.target;
  const mode = target?.mode ?? "none";
  const changeMode = (next: string) => updateSelected({ target: next === "none" ? undefined : next === "measure" ? { mode: "measure", measure: (measures.find((field) => field.key !== selected.measure)?.key ?? measures[0]?.key) as keyof ManufacturingRecord, aggregation: "sum", direction: "higherIsBetter", varianceFormat: "percent" } : { mode: "constant", value: selected.format === "percent" ? 1 : 0, direction: "higherIsBetter", varianceFormat: "percent" } });
  return <div className="settings-group" data-kpi-target-editor><strong>KPI target</strong><label>Target source<select aria-label="KPI target source" value={mode} onChange={(event) => changeMode(event.target.value)}><option value="none">None</option><option value="constant">Constant</option><option value="measure">Another measure</option></select></label>{target?.mode === "constant" && <label>Target value<input aria-label="KPI target value" type="number" step="any" value={target.value ?? 0} onChange={(event) => updateSelected({ target: { ...target, value: Number(event.target.value) } })} /></label>}{target?.mode === "measure" && <><label>Target measure<select aria-label="KPI target measure" value={target.measure ?? ""} onChange={(event) => updateSelected({ target: { ...target, measure: event.target.value as keyof ManufacturingRecord } })}>{measures.map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select></label><label>Target aggregation<select aria-label="KPI target aggregation" value={target.aggregation ?? "sum"} onChange={(event) => updateSelected({ target: { ...target, aggregation: event.target.value as Aggregation } })}>{["sum", "average", "minimum", "maximum", "count", "distinctCount"].map((value) => <option value={value} key={value}>{value}</option>)}</select></label></>} {target && <><label>Success direction<select aria-label="KPI success direction" value={target.direction ?? "higherIsBetter"} onChange={(event) => updateSelected({ target: { ...target, direction: event.target.value as NonNullable<typeof target.direction> } })}><option value="higherIsBetter">Higher is better</option><option value="lowerIsBetter">Lower is better</option></select></label><label>Variance display<select aria-label="KPI variance display" value={target.varianceFormat ?? "percent"} onChange={(event) => updateSelected({ target: { ...target, varianceFormat: event.target.value as NonNullable<typeof target.varianceFormat> } })}><option value="percent">Percentage</option><option value="value">Value</option></select></label></>}</div>;
}

function TabularBuildSettings({ selected, fields, dimensions, updateSelected }: { selected: VisualDefinition; fields: Dataset["fields"]; dimensions: Dataset["fields"]; updateSelected: (changes: Partial<VisualDefinition>) => void }) {
  const columns = resolvedTabularColumns(selected);
  const matrixRows = resolvedMatrixRows(selected);
  const options = selected.tabular ?? {};
  const updateOptions = (changes: NonNullable<VisualDefinition["tabular"]>) => updateSelected({ tabular: { ...options, ...changes } });
  const updateColumns = (next: TabularColumnDefinition[]) => updateOptions({ columns: next });
  const updateColumn = (index: number, changes: Partial<TabularColumnDefinition>) => updateColumns(columns.map((column, columnIndex) => columnIndex === index ? { ...column, ...changes } : column));
  const move = <T,>(items: T[], index: number, direction: -1 | 1): T[] => { const target = index + direction; if (target < 0 || target >= items.length) return items; const next = [...items]; [next[index], next[target]] = [next[target]!, next[index]!]; return next; };
  const addColumn = () => { const field = fields.find((item) => !columns.some((column) => column.field === item.key)); if (field) updateColumns([...columns, { field: field.key as keyof ManufacturingRecord, label: field.displayName, format: field.semanticType === "measure" ? "number" : field.semanticType === "date" ? "date" : "text", aggregation: selected.type === "matrix" ? field.defaultAggregation === "none" ? "count" : field.defaultAggregation : undefined, alignment: field.semanticType === "measure" ? "right" : "left", width: 100 }]); };
  const addMatrixRow = () => { const field = dimensions.find((item) => !matrixRows.includes(item.key as keyof ManufacturingRecord)); if (field) updateOptions({ matrixRows: [...matrixRows, field.key as keyof ManufacturingRecord] }); };
  return <div className="form-stack tabular-build-settings">
    {selected.type === "matrix" && <div className="settings-group"><div className="field-well-heading"><strong>Matrix rows</strong><button className="icon-button" type="button" aria-label="Add matrix row field" disabled={matrixRows.length >= dimensions.length || matrixRows.length >= 4} onClick={addMatrixRow}><Plus size={12} /></button></div><div className="field-well-list">{matrixRows.map((field, index) => <div className="field-well-row field-well-select-row" key={`${field}-${index}`}><select aria-label={`Matrix row field ${index + 1}`} value={field} onChange={(event) => updateOptions({ matrixRows: matrixRows.map((item, itemIndex) => itemIndex === index ? event.target.value as keyof ManufacturingRecord : item) })}>{dimensions.filter((item) => item.key === field || !matrixRows.includes(item.key as keyof ManufacturingRecord)).map((item) => <option value={item.key} key={item.id}>{item.displayName}</option>)}</select><button type="button" aria-label={`Move matrix row ${String(field)} up`} disabled={index === 0} onClick={() => updateOptions({ matrixRows: move(matrixRows, index, -1) })}><ChevronUp size={11} /></button><button type="button" aria-label={`Move matrix row ${String(field)} down`} disabled={index === matrixRows.length - 1} onClick={() => updateOptions({ matrixRows: move(matrixRows, index, 1) })}><ChevronDown size={11} /></button><button type="button" aria-label={`Remove matrix row ${String(field)}`} disabled={matrixRows.length === 1} onClick={() => updateOptions({ matrixRows: matrixRows.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={11} /></button></div>)}</div></div>}
    <div className="settings-group"><div className="field-well-heading"><strong>{selected.type === "matrix" ? "Matrix values" : "Table columns"}</strong><button className="icon-button" type="button" aria-label="Add tabular column" disabled={columns.length >= fields.length || columns.length >= 12} onClick={addColumn}><Plus size={12} /></button></div><div className="tabular-column-list">{columns.map((column, index) => <div className="tabular-column-card" data-tabular-column={column.field} key={`${column.field}-${index}`}><div className="tabular-column-heading"><select aria-label={`Tabular column ${index + 1}`} value={column.field} onChange={(event) => updateColumn(index, { field: event.target.value as keyof ManufacturingRecord })}>{fields.filter((field) => field.key === column.field || !columns.some((item) => item.field === field.key)).map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select><button type="button" aria-label={`Move tabular column ${String(column.field)} up`} disabled={index === 0} onClick={() => updateColumns(move(columns, index, -1))}><ChevronUp size={11} /></button><button type="button" aria-label={`Move tabular column ${String(column.field)} down`} disabled={index === columns.length - 1} onClick={() => updateColumns(move(columns, index, 1))}><ChevronDown size={11} /></button><button type="button" aria-label={`Remove tabular column ${String(column.field)}`} disabled={columns.length === 1} onClick={() => updateColumns(columns.filter((_, columnIndex) => columnIndex !== index))}><Trash2 size={11} /></button></div><label>Header<input aria-label={`Tabular header ${index + 1}`} value={column.label ?? ""} onChange={(event) => updateColumn(index, { label: event.target.value })} /></label><div className="tabular-column-options"><label>Format<select aria-label={`Tabular format ${index + 1}`} value={column.format ?? "auto"} onChange={(event) => updateColumn(index, { format: event.target.value as TabularColumnDefinition["format"] })}><option value="auto">Auto</option><option value="text">Text</option><option value="number">Number</option><option value="percent">Percentage</option><option value="date">Date</option></select></label><label>Align<select aria-label={`Tabular alignment ${index + 1}`} value={column.alignment ?? "left"} onChange={(event) => updateColumn(index, { alignment: event.target.value as TabularColumnDefinition["alignment"] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label><label>Width<input aria-label={`Tabular width ${index + 1}`} type="number" min="50" max="320" value={column.width ?? 100} onChange={(event) => updateColumn(index, { width: Math.max(50, Math.min(320, Number(event.target.value) || 100)) })} /></label>{selected.type === "matrix" && <label>Summarize<select aria-label={`Tabular aggregation ${index + 1}`} value={column.aggregation ?? "sum"} onChange={(event) => updateColumn(index, { aggregation: event.target.value as Aggregation })}>{["sum", "average", "minimum", "maximum", "count", "distinctCount"].map((value) => <option value={value} key={value}>{value}</option>)}</select></label>}</div></div>)}</div></div>
    <div className="settings-group"><strong>Rows and totals</strong>{selected.type === "table" && <label>Maximum rows<input aria-label="Table row limit" type="number" min="1" max="500" value={options.rowLimit ?? 100} onChange={(event) => updateOptions({ rowLimit: Math.max(1, Math.min(500, Number(event.target.value) || 1)) })} /></label>}{selected.type === "matrix" && <label className="toggle-row"><span>Show grand total</span><input aria-label="Show matrix totals" type="checkbox" checked={options.showTotals !== false} onChange={(event) => updateOptions({ showTotals: event.target.checked })} /></label>}<label className="toggle-row"><span>Striped rows</span><input aria-label="Use striped tabular rows" type="checkbox" checked={options.stripedRows ?? false} onChange={(event) => updateOptions({ stripedRows: event.target.checked })} /></label><label>Density<select aria-label="Tabular row density" value={options.density ?? "standard"} onChange={(event) => updateOptions({ density: event.target.value as NonNullable<typeof options.density> })}><option value="compact">Compact</option><option value="standard">Standard</option><option value="comfortable">Comfortable</option></select></label></div>
  </div>;
}

function ConditionalFormattingEditor({ selected, measures, updateSelected }: { selected: VisualDefinition; measures: Dataset["fields"]; updateSelected: (changes: Partial<VisualDefinition>) => void }) {
  const formatting = selected.conditionalFormatting ?? { rules: [] };
  const rules = formatting.rules;
  const updateRules = (next: ConditionalFormattingRule[]) => updateSelected({ conditionalFormatting: { ...formatting, rules: next } });
  const updateRule = (id: string, changes: Partial<ConditionalFormattingRule>) => updateRules(rules.map((rule) => rule.id === id ? { ...rule, ...changes } : rule));
  const addRule = () => updateRules([...rules, { id: crypto.randomUUID(), field: (selected.measure ?? measures[0]?.key ?? "ActualQty") as keyof ManufacturingRecord, operator: "greaterThanOrEqual", value: 0, target: selected.type === "table" || selected.type === "matrix" ? "backgroundColor" : "dataColor", color: "#18a66a" }]);
  const operators: Array<{ value: ConditionalFormattingOperator; label: string }> = [
    { value: "greaterThan", label: "Greater than" }, { value: "greaterThanOrEqual", label: "At least" }, { value: "lessThan", label: "Less than" },
    { value: "lessThanOrEqual", label: "At most" }, { value: "equals", label: "Equals" }, { value: "between", label: "Between" },
  ];
  return <div className="settings-group conditional-formatting-editor">
    <div className="conditional-formatting-heading"><div><strong>Conditional formatting</strong><span>Rules run in order; the first match per target wins.</span></div><button className="icon-button" type="button" aria-label="Add conditional rule" onClick={addRule}><Plus size={13} /></button></div>
    <label>Default data color<input type="color" aria-label="Default conditional data color" value={formatting.defaultColor ?? selected.display?.accentColor ?? "#5c73e6"} onChange={(event) => updateSelected({ conditionalFormatting: { ...formatting, defaultColor: event.target.value, rules } })} /></label>
    {rules.map((rule, index) => <div className="conditional-rule-card" data-rule-id={rule.id} key={rule.id}>
      <div className="conditional-rule-heading"><strong>Rule {index + 1}</strong><button className="icon-button danger" type="button" aria-label={`Remove conditional rule ${index + 1}`} onClick={() => updateRules(rules.filter((item) => item.id !== rule.id))}><Trash2 size={11} /></button></div>
      <label>Field<select aria-label={`Conditional field ${index + 1}`} value={rule.field} onChange={(event) => updateRule(rule.id, { field: event.target.value as keyof ManufacturingRecord })}>{measures.map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select></label>
      <label>Apply to<select aria-label={`Conditional target ${index + 1}`} value={rule.target} onChange={(event) => updateRule(rule.id, { target: event.target.value as ConditionalFormattingRule["target"] })}><option value="dataColor">Chart / KPI data color</option><option value="backgroundColor">Cell / KPI background</option><option value="textColor">Cell / KPI text</option><option value="dataBar">Table / matrix data bar</option></select></label>
      <label>Condition<select aria-label={`Conditional operator ${index + 1}`} value={rule.operator} onChange={(event) => updateRule(rule.id, { operator: event.target.value as ConditionalFormattingOperator })}>{operators.map((operator) => <option value={operator.value} key={operator.value}>{operator.label}</option>)}</select></label>
      <div className={`conditional-rule-values ${rule.operator === "between" ? "between" : ""}`}><label>{rule.operator === "between" ? "From" : "Value"}<input type="number" step="any" aria-label={`Conditional value ${index + 1}`} value={rule.value} onChange={(event) => updateRule(rule.id, { value: Number(event.target.value) })} /></label>{rule.operator === "between" && <label>To<input type="number" step="any" aria-label={`Conditional second value ${index + 1}`} value={rule.secondValue ?? rule.value} onChange={(event) => updateRule(rule.id, { secondValue: Number(event.target.value) })} /></label>}</div>
      <label>Color<input type="color" aria-label={`Conditional color ${index + 1}`} value={rule.color} onChange={(event) => updateRule(rule.id, { color: event.target.value })} /></label>
    </div>)}
    {!rules.length && <p className="muted filter-empty">No rules. Add one to color values by thresholds.</p>}
  </div>;
}

function ReportFormatSettings({ theme, page, updateTheme, updateCanvas, applyTheme }: { theme: ReportThemeDefinition; page: ReportPage; updateTheme: (changes: Partial<ReportThemeDefinition>) => void; updateCanvas: (changes: Partial<ReportPageCanvasOptions>) => void; applyTheme: () => void }) {
  const canvas = page.canvas ?? {};
  return <div className="form-stack report-format-settings">
    <div className="panel-header"><div><h3>Report and page</h3><p>Theme, wallpaper, and layout grid</p></div></div>
    <div className="settings-group"><strong>Report theme</strong><label>Theme name<input aria-label="Report theme name" value={theme.name} onChange={(event) => updateTheme({ name: event.target.value })} /></label><div className="theme-color-grid"><label>Accent<input aria-label="Report accent color" type="color" value={theme.accentColor} onChange={(event) => updateTheme({ accentColor: event.target.value })} /></label><label>Secondary<input aria-label="Report secondary color" type="color" value={theme.secondaryColor} onChange={(event) => updateTheme({ secondaryColor: event.target.value })} /></label><label>Surface<input aria-label="Report surface color" type="color" value={theme.surfaceColor} onChange={(event) => updateTheme({ surfaceColor: event.target.value })} /></label><label>Text<input aria-label="Report text color" type="color" value={theme.textColor} onChange={(event) => updateTheme({ textColor: event.target.value })} /></label></div><label>Font family<input aria-label="Report font family" value={theme.fontFamily ?? ""} onChange={(event) => updateTheme({ fontFamily: event.target.value })} /></label><button className="button" type="button" onClick={applyTheme}><Check size={13} /> Apply theme to this page</button></div>
    <div className="settings-group"><strong>Page canvas</strong><label>Background<input aria-label="Page background color" type="color" value={canvas.backgroundColor ?? theme.canvasColor} onChange={(event) => updateCanvas({ backgroundColor: event.target.value })} /></label><label>Wallpaper URL<input aria-label="Page wallpaper URL" placeholder="https://… or data:image/…" value={canvas.wallpaperUrl ?? ""} onChange={(event) => updateCanvas({ wallpaperUrl: event.target.value })} /></label><label>Wallpaper fit<select aria-label="Page wallpaper fit" value={canvas.wallpaperFit ?? "cover"} onChange={(event) => updateCanvas({ wallpaperFit: event.target.value as NonNullable<ReportPageCanvasOptions["wallpaperFit"]> })}><option value="cover">Cover</option><option value="contain">Contain</option><option value="fill">Stretch</option></select></label><label className="toggle-row"><span>Show grid</span><input aria-label="Show page grid" type="checkbox" checked={canvas.showGrid !== false} onChange={(event) => updateCanvas({ showGrid: event.target.checked })} /></label><label className="toggle-row"><span>Snap to grid</span><input aria-label="Snap items to grid" type="checkbox" checked={canvas.snapToGrid !== false} onChange={(event) => updateCanvas({ snapToGrid: event.target.checked })} /></label><label>Snap interval<select aria-label="Page grid interval" value={canvas.gridSize ?? 1} onChange={(event) => updateCanvas({ gridSize: Number(event.target.value) as 1 | 2 | 3 })}><option value="1">Fine · 1 cell</option><option value="2">Medium · 2 cells</option><option value="3">Coarse · 3 cells</option></select></label></div>
  </div>;
}

function SelectionPane({ page, selectedId, onSelect, onVisibility, onMobileVisibility, onMove }: { page: ReportPage; selectedId?: string; onSelect: (id: string) => void; onVisibility: (id: string, hidden: boolean) => void; onMobileVisibility: (id: string, hidden: boolean) => void; onMove: (id: string, direction: -1 | 1) => void }) {
  const visuals = page.visuals.map((item, index) => ({ ...item, kind: "Visual", order: index, count: page.visuals.length }));
  const controls = (page.controls ?? []).map((item, index, collection) => ({ ...item, kind: ["textBox", "shape", "image"].includes(item.type) ? "Object" : "Control", order: index, count: collection.length }));
  const items = [...visuals, ...controls];
  return <div className="form-stack"><div className="panel-header"><div><h3>Selection pane</h3><p>Desktop/mobile visibility and canvas order</p></div></div><div className="selection-list">{items.map((item) => { const mobileItem = page.mobileLayout?.items.find((entry) => entry.itemId === item.id); const mobileHidden = page.mobileLayout?.enabled ? !mobileItem || Boolean(mobileItem.hidden) : false; return <div className={`selection-item ${item.id === selectedId ? "selected" : ""}`} key={item.id}><button className="selection-name" type="button" onClick={() => onSelect(item.id)}><span>{item.kind}</span><strong>{item.title}</strong></button><button className="icon-button" type="button" aria-label={`${item.hidden ? "Show" : "Hide"} ${item.title}`} aria-pressed={Boolean(item.hidden)} title="Desktop and mobile visibility" onClick={() => onVisibility(item.id, !item.hidden)}>{item.hidden ? <EyeOff size={13} /> : <Eye size={13} />}</button><button className={`icon-button ${mobileHidden ? "muted" : ""}`} type="button" aria-label={`${mobileHidden ? "Show" : "Hide"} ${item.title} on mobile`} aria-pressed={mobileHidden} title="Mobile visibility" onClick={() => onMobileVisibility(item.id, !mobileHidden)}><Smartphone size={13} /></button><button className="icon-button" type="button" aria-label={`Move ${item.title} earlier`} disabled={item.order === 0} onClick={() => onMove(item.id, -1)}><ChevronUp size={13} /></button><button className="icon-button" type="button" aria-label={`Move ${item.title} later`} disabled={item.order === item.count - 1} onClick={() => onMove(item.id, 1)}><ChevronDown size={13} /></button></div>; })}</div>{!items.length && <div className="empty-state compact">This page has no report objects.</div>}</div>;
}

function AccessibilityPane({ page, theme, onSelect, highContrast, onToggleHighContrast }: { page: ReportPage; theme: ReportThemeDefinition; onSelect: (id: string) => void; highContrast: boolean; onToggleHighContrast: () => void }) {
  const issues = auditReportPage(page, theme);
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const textRatio = contrastRatio(theme.textColor, theme.surfaceColor);
  const accentRatio = contrastRatio(theme.accentColor, theme.surfaceColor);
  return <div className="form-stack accessibility-pane"><div className="panel-header"><div><h3>Accessibility inspector</h3><p>Names, alternatives, contrast, and mobile placement</p></div></div><div className={`accessibility-summary ${errors ? "failed" : "passed"}`}><ShieldCheck size={18} /><div><strong>{errors ? `${errors} blocking ${errors === 1 ? "issue" : "issues"}` : "No blocking issues"}</strong><span>{issues.length - errors} warnings · {page.visuals.length + (page.controls?.length ?? 0)} objects inspected</span></div></div><div className="settings-group"><strong>Contrast validation</strong><div className="contrast-result"><span>Text / surface</span><b className={(textRatio ?? 0) >= 4.5 ? "passed" : "failed"}>{textRatio?.toFixed(2) ?? "—"}:1</b></div><div className="contrast-result"><span>Accent / surface</span><b className={(accentRatio ?? 0) >= 3 ? "passed" : "failed"}>{accentRatio?.toFixed(2) ?? "—"}:1</b></div><button className={`button ${highContrast ? "active" : ""}`} type="button" aria-pressed={highContrast} onClick={onToggleHighContrast}><Contrast size={13} /> {highContrast ? "Exit high contrast preview" : "Preview high contrast"}</button></div><div className="accessibility-issues">{issues.map((issue) => <button type="button" className={`accessibility-issue ${issue.severity}`} data-a11y-issue={issue.code} key={issue.id} onClick={() => issue.itemId && onSelect(issue.itemId)} disabled={!issue.itemId}><span>{issue.severity}</span><strong>{issue.message}</strong></button>)}</div>{!issues.length && <div className="empty-state compact">This page passes the current automated authoring checks. Manual keyboard and screen-reader review is still recommended.</div>}<div className="settings-group keyboard-help"><strong>Keyboard editing</strong><span><kbd>Arrow keys</kbd> Move selected object</span><span><kbd>Shift</kbd> + <kbd>Arrow</kbd> Resize</span><span><kbd>Delete</kbd> Remove</span><span><kbd>Ctrl</kbd> + <kbd>C/V/Z/Y</kbd> Copy, paste, undo, redo</span></div></div>;
}

function FormatSettings({ selected, page, measures, presets, updateSelected, updateDisplay, updateInteraction, updateVisualInteraction, savePreset, deletePreset }: { selected: VisualDefinition; page: ReportPage; measures: Dataset["fields"]; presets: ReportFormatPreset[]; updateSelected: (changes: Partial<VisualDefinition>) => void; updateDisplay: (changes: NonNullable<VisualDefinition["display"]>) => void; updateInteraction: (changes: NonNullable<VisualDefinition["interaction"]>) => void; updateVisualInteraction: (sourceVisualId: string, targetVisualId: string, mode: VisualInteractionMode) => void; savePreset: (name: string) => void; deletePreset: (id: string) => void }) {
  const display = selected.display ?? {};
  const interaction = selected.interaction ?? {};
  const targets = page.visuals.filter((visual) => visual.id !== selected.id);
  const [presetName, setPresetName] = useState("");
  return <div className="form-stack">
    <div className="panel-header"><div><h3>Format visual</h3><p>Appearance and behavior</p></div></div>
    <div className="settings-group"><strong>Format presets</strong><div className="preset-create-row"><input aria-label="New format preset name" placeholder="Preset name" value={presetName} onChange={(event) => setPresetName(event.target.value)} /><button className="icon-button" type="button" aria-label="Save preset" disabled={!presetName.trim()} onClick={() => { savePreset(presetName); setPresetName(""); }}><Save size={13} /></button></div><div className="preset-list">{presets.map((preset) => <div key={preset.id}><button type="button" aria-label={`Apply preset ${preset.name}`} onClick={() => updateSelected({ display: structuredClone(preset.display) })}>{preset.name}</button><button className="icon-button danger" type="button" aria-label={`Delete preset ${preset.name}`} onClick={() => deletePreset(preset.id)}><Trash2 size={11} /></button></div>)}</div>{!presets.length && <p className="muted filter-empty">Save the current appearance to reuse it on another visual.</p>}</div>
    <div className="settings-group"><strong>Title and style</strong><label className="toggle-row"><span>Show title</span><input type="checkbox" checked={display.showTitle !== false} onChange={(event) => updateDisplay({ showTitle: event.target.checked })} /></label><label>Title alignment<select value={display.titleAlignment ?? "left"} onChange={(event) => updateDisplay({ titleAlignment: event.target.value as "left" | "center" | "right" })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label><label>Accent color<input type="color" value={display.accentColor ?? "#5c73e6"} onChange={(event) => updateDisplay({ accentColor: event.target.value })} /></label><label>Background<input type="color" value={display.backgroundColor ?? "#ffffff"} onChange={(event) => updateDisplay({ backgroundColor: event.target.value })} /></label><label>Corner radius<input type="range" min="0" max="24" value={display.borderRadius ?? 10} onChange={(event) => updateDisplay({ borderRadius: Number(event.target.value) })} /></label></div>
    <div className="settings-group"><strong>Chart elements</strong><label className="toggle-row"><span>Legend</span><input type="checkbox" checked={display.showLegend ?? false} onChange={(event) => updateDisplay({ showLegend: event.target.checked })} /></label><label className="toggle-row"><span>Data labels</span><input type="checkbox" checked={display.showDataLabels ?? false} onChange={(event) => updateDisplay({ showDataLabels: event.target.checked })} /></label><label className="toggle-row"><span>Gridlines</span><input type="checkbox" checked={display.showGridlines !== false} onChange={(event) => updateDisplay({ showGridlines: event.target.checked })} /></label></div>
    <ConditionalFormattingEditor selected={selected} measures={measures} updateSelected={updateSelected} />
    <div className="settings-group"><strong>Source behavior</strong><label className="toggle-row"><span>Interactions enabled by default</span><input type="checkbox" checked={interaction.crossFilter !== false} onChange={(event) => updateInteraction({ crossFilter: event.target.checked })} /></label><label className="toggle-row"><span>Tooltips</span><input type="checkbox" checked={interaction.tooltips !== false} onChange={(event) => updateInteraction({ tooltips: event.target.checked })} /></label></div>
    <div className="settings-group interaction-editor"><strong>Edit visual interactions</strong><p>Choose how a selection in <b>{selected.title}</b> affects every target.</p>{selected.dimension ? targets.map((target) => {
      const configured = page.interactions?.find((item) => item.sourceVisualId === selected.id && item.targetVisualId === target.id);
      const mode = configured?.mode ?? (interaction.crossFilter === false ? "none" : "filter");
      return <div className="interaction-target-row" key={target.id}><span title={target.title}>{target.title}</span><div role="group" aria-label={`${selected.title} to ${target.title}`}><button type="button" className={mode === "filter" ? "active" : ""} aria-label={`Filter ${selected.title} to ${target.title}`} aria-pressed={mode === "filter"} title="Filter" onClick={() => updateVisualInteraction(selected.id, target.id, "filter")}><Filter size={13} /></button><button type="button" className={mode === "highlight" ? "active" : ""} aria-label={`Highlight ${selected.title} to ${target.title}`} aria-pressed={mode === "highlight"} title="Highlight" onClick={() => updateVisualInteraction(selected.id, target.id, "highlight")}><Sparkles size={13} /></button><button type="button" className={mode === "none" ? "active" : ""} aria-label={`No interaction from ${selected.title} to ${target.title}`} aria-pressed={mode === "none"} title="None" onClick={() => updateVisualInteraction(selected.id, target.id, "none")}><Ban size={13} /></button></div></div>;
    }) : <p className="muted">Assign a category field before configuring this visual as an interaction source.</p>}</div>
  </div>;
}

function ControlBuildSettings({ selected, pages, bookmarks, updateSelected, onDelete }: { selected: ReportControlDefinition; pages: ReportPage[]; bookmarks: ReportBookmarkDefinition[]; updateSelected: (changes: Partial<ReportControlDefinition>) => void; onDelete: () => void }) {
  const visiblePages = pages.filter((page) => !page.hidden);
  const action = selected.action ?? { type: "page" as const, targetId: visiblePages[0]?.id };
  const changeType = (type: ReportControlType) => updateSelected({ type, title: type === "button" ? "Open page" : type === "pageNavigator" ? "Report pages" : type === "bookmarkNavigator" ? "Saved views" : type === "textBox" ? "Text box" : type === "shape" ? "Shape" : "Image", content: type === "textBox" ? selected.content ?? "Add report context." : undefined, altText: type === "shape" ? selected.altText ?? "Decorative shape" : type === "image" ? selected.altText ?? "Report image" : undefined, action: type === "button" ? action : undefined });
  const changeAction = (type: ReportActionType) => updateSelected({ action: { type, targetId: type === "page" ? visiblePages[0]?.id : type === "bookmark" ? bookmarks[0]?.id : undefined } });
  return <div className="form-stack">
    <div className="panel-header"><div><h3>Build control</h3><p>Published report navigation</p></div><button className="icon-button danger" aria-label="Delete control" onClick={onDelete}><Trash2 size={14} /></button></div>
    <label>Control type<select aria-label="Control type" value={selected.type} onChange={(event) => changeType(event.target.value as ReportControlType)}><option value="button">Button</option><option value="pageNavigator">Page navigator</option><option value="bookmarkNavigator">Bookmark navigator</option><option value="textBox">Text box</option><option value="shape">Shape</option><option value="image">Image</option></select></label>
    <label>Accessible title<input aria-label="Control title" value={selected.title} onChange={(event) => updateSelected({ title: event.target.value })} /></label>
    {selected.type === "textBox" && <label>Text content<textarea aria-label="Text box content" value={selected.content ?? ""} onChange={(event) => updateSelected({ content: event.target.value })} /></label>}
    {selected.type === "shape" && <><label>Shape<select aria-label="Shape type" value={selected.display?.shape ?? "roundedRectangle"} onChange={(event) => updateSelected({ display: { ...selected.display, shape: event.target.value as NonNullable<ReportControlDefinition["display"]>["shape"] } })}><option value="rectangle">Rectangle</option><option value="roundedRectangle">Rounded rectangle</option><option value="ellipse">Ellipse</option><option value="line">Line</option></select></label><label>Alternative text<input aria-label="Shape alternative text" value={selected.altText ?? ""} onChange={(event) => updateSelected({ altText: event.target.value })} /></label></>}
    {selected.type === "image" && <><label>Image URL<input aria-label="Image source URL" placeholder="https://… or data:image/…" value={selected.imageUrl ?? ""} onChange={(event) => updateSelected({ imageUrl: event.target.value })} /></label><label>Alternative text<input aria-label="Image alternative text" value={selected.altText ?? ""} onChange={(event) => updateSelected({ altText: event.target.value })} /></label><label>Image fit<select aria-label="Image fit" value={selected.display?.imageFit ?? "contain"} onChange={(event) => updateSelected({ display: { ...selected.display, imageFit: event.target.value as NonNullable<ReportControlDefinition["display"]>["imageFit"] } })}><option value="contain">Contain</option><option value="cover">Cover</option><option value="fill">Stretch</option></select></label></>}
    {selected.type === "button" && <div className="settings-group"><strong>Action</strong><label>Action type<select aria-label="Button action" value={action.type} onChange={(event) => changeAction(event.target.value as ReportActionType)}><option value="page">Page navigation</option><option value="bookmark">Report bookmark</option><option value="back">Back / drillthrough return</option><option value="resetFilters">Reset filters</option></select></label>{action.type === "page" && <label>Target page<select aria-label="Button target page" value={action.targetId ?? ""} onChange={(event) => updateSelected({ action: { type: "page", targetId: event.target.value } })}>{visiblePages.map((page) => <option value={page.id} key={page.id}>{page.name}</option>)}</select></label>}{action.type === "bookmark" && <label>Target bookmark<select aria-label="Button target bookmark" value={action.targetId ?? ""} onChange={(event) => updateSelected({ action: { type: "bookmark", targetId: event.target.value } })}>{bookmarks.map((bookmark) => <option value={bookmark.id} key={bookmark.id}>{bookmark.name}</option>)}</select></label>}</div>}
    {selected.type === "pageNavigator" && <p className="muted">Automatically shows all visible report pages and tracks the active page.</p>}
    {selected.type === "bookmarkNavigator" && <p className="muted">Automatically shows every report-owned bookmark in its saved order.</p>}
  </div>;
}

function ControlFormatSettings({ selected, updateSelected }: { selected: ReportControlDefinition; updateSelected: (changes: Partial<ReportControlDefinition>) => void }) {
  const display = selected.display ?? {};
  const updateDisplay = (changes: NonNullable<ReportControlDefinition["display"]>) => updateSelected({ display: { ...display, ...changes } });
  const textLike = selected.type === "textBox";
  return <div className="form-stack"><div className="panel-header"><div><h3>Format control</h3><p>{["textBox", "shape", "image"].includes(selected.type) ? "Canvas object appearance" : "Navigation appearance"}</p></div></div><div className="settings-group"><strong>Colors and border</strong><label>Accent color<input aria-label="Control accent color" type="color" value={display.accentColor ?? "#5c73e6"} onChange={(event) => updateDisplay({ accentColor: event.target.value })} /></label><label>Background<input aria-label="Control background color" type="color" value={display.backgroundColor ?? "#ffffff"} onChange={(event) => updateDisplay({ backgroundColor: event.target.value })} /></label><label>Text color<input aria-label="Control text color" type="color" value={display.textColor ?? "#172033"} onChange={(event) => updateDisplay({ textColor: event.target.value })} /></label><label>Border color<input aria-label="Control border color" type="color" value={display.borderColor ?? "#d8dfeb"} onChange={(event) => updateDisplay({ borderColor: event.target.value })} /></label><label>Border width<input aria-label="Control border width" type="range" min="0" max="8" value={display.borderWidth ?? 1} onChange={(event) => updateDisplay({ borderWidth: Number(event.target.value) })} /></label><label>Corner radius<input aria-label="Control corner radius" type="range" min="0" max="40" value={display.borderRadius ?? 9} onChange={(event) => updateDisplay({ borderRadius: Number(event.target.value) })} /></label></div>{textLike && <div className="settings-group"><strong>Typography</strong><label>Font size<input aria-label="Text box font size" type="number" min="8" max="72" value={display.fontSize ?? 14} onChange={(event) => updateDisplay({ fontSize: Math.max(8, Math.min(72, Number(event.target.value) || 14)) })} /></label><label>Weight<select aria-label="Text box font weight" value={display.fontWeight ?? "normal"} onChange={(event) => updateDisplay({ fontWeight: event.target.value as NonNullable<typeof display.fontWeight> })}><option value="normal">Normal</option><option value="semibold">Semibold</option><option value="bold">Bold</option></select></label><label>Horizontal alignment<select aria-label="Text box horizontal alignment" value={display.textAlignment ?? "left"} onChange={(event) => updateDisplay({ textAlignment: event.target.value as NonNullable<typeof display.textAlignment> })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label><label>Vertical alignment<select aria-label="Text box vertical alignment" value={display.verticalAlignment ?? "center"} onChange={(event) => updateDisplay({ verticalAlignment: event.target.value as NonNullable<typeof display.verticalAlignment> })}><option value="start">Top</option><option value="center">Middle</option><option value="end">Bottom</option></select></label></div>}</div>;
}

function BookmarkSettings({ selected, pages, rows, updateSelected, onDelete }: { selected: ReportBookmarkDefinition; pages: ReportPage[]; rows: ManufacturingRecord[]; updateSelected: (changes: Partial<ReportBookmarkDefinition>) => void; onDelete: () => void }) {
  const filters = selected.filters ?? {};
  const updateFilter = (field: keyof NonNullable<ReportBookmarkDefinition["filters"]>, value: string) => updateSelected({ filters: { ...filters, [field]: value } });
  const unique = (field: "Line" | "Model" | "Customer" | "Shift") => [...new Set(rows.map((row) => String(row[field])))].sort();
  return <div className="form-stack">
    <div className="panel-header"><div><h3>Report bookmark</h3><p>Shared with every viewer</p></div><button className="icon-button danger" aria-label="Delete report bookmark" onClick={onDelete}><Trash2 size={14} /></button></div>
    <label>Bookmark name<input aria-label="Report bookmark name" value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })} /></label>
    <label>Target page<select aria-label="Report bookmark page" value={selected.pageId} onChange={(event) => updateSelected({ pageId: event.target.value })}>{pages.map((page) => <option value={page.id} key={page.id}>{page.name}{page.hidden ? " (hidden)" : ""}</option>)}</select></label>
    <div className="settings-group"><strong>Captured filters</strong><label>Date from<input aria-label="Report bookmark date from" type="date" value={filters.from ?? ""} onChange={(event) => updateFilter("from", event.target.value)} /></label><label>Date to<input aria-label="Report bookmark date to" type="date" value={filters.to ?? ""} onChange={(event) => updateFilter("to", event.target.value)} /></label>{(["Line", "Model", "Customer", "Shift"] as const).map((field) => <label key={field}>{field}<select aria-label={`Report bookmark ${field}`} value={filters[field] ?? ""} onChange={(event) => updateFilter(field, event.target.value)}><option value="">All</option>{unique(field).map((value) => <option key={value}>{value}</option>)}</select></label>)}<button className="button" type="button" onClick={() => updateSelected({ filters: {} })}><RotateCcw size={13} /> Clear captured filters</button></div>
  </div>;
}

function FilterEditor({ title, filters, fields, onChange }: { title: string; filters: ReportFilterDefinition[]; fields: Dataset["fields"]; onChange: (filters: ReportFilterDefinition[]) => void }) {
  const operatorOptions: Array<{ value: ReportFilterDefinition["operator"]; label: string }> = [
    { value: "equals", label: "is" }, { value: "notEquals", label: "is not" }, { value: "contains", label: "contains" }, { value: "notContains", label: "does not contain" },
    { value: "startsWith", label: "starts with" }, { value: "endsWith", label: "ends with" }, { value: "greaterThan", label: "is greater than" }, { value: "greaterThanOrEqual", label: "is at least" },
    { value: "lessThan", label: "is less than" }, { value: "lessThanOrEqual", label: "is at most" }, { value: "isBlank", label: "is blank" }, { value: "isNotBlank", label: "is not blank" },
  ];
  const measures = fields.filter((field) => field.semanticType === "measure");
  const dimensions = fields.filter((field) => field.semanticType !== "measure");
  const dates = fields.filter((field) => field.semanticType === "date" || field.dataType === "date" || field.dataType === "datetime");
  const add = () => {
    const first = fields[0];
    if (first) onChange([...filters, { id: crypto.randomUUID(), field: first.key as ReportFilterDefinition["field"], operator: "equals", value: "", mode: "basic" }]);
  };
  const update = (id: string, changes: Partial<ReportFilterDefinition>) => onChange(filters.map((filter) => filter.id === id ? { ...filter, ...changes } : filter));
  const changeMode = (filter: ReportFilterDefinition, mode: NonNullable<ReportFilterDefinition["mode"]>) => {
    if (mode === "relativeDate") update(filter.id, { mode, field: (dates[0]?.key ?? filter.field) as keyof ManufacturingRecord, relativeDate: filter.relativeDate ?? { direction: "last", amount: 30, unit: "days", includeToday: true } });
    else if (mode === "topN") update(filter.id, { mode, field: (dimensions[0]?.key ?? filter.field) as keyof ManufacturingRecord, topN: filter.topN ?? { direction: "top", count: 5, byMeasure: (measures[0]?.key ?? "ActualQty") as keyof ManufacturingRecord, aggregation: "sum" } });
    else if (mode === "advanced") update(filter.id, { mode, clauses: filter.clauses?.length ? filter.clauses : [{ operator: filter.operator, value: filter.value }, { operator: "notEquals", value: "" }], logicalOperator: filter.logicalOperator ?? "and" });
    else update(filter.id, { mode });
  };
  return <section className="filter-editor">
    <div className="panel-header"><div><h3>{title}</h3><p>{filters.length} configured</p></div><button className="icon-button" onClick={add} aria-label={`Add ${title.toLocaleLowerCase()}`}><Plus size={13} /></button></div>
    {filters.map((filter) => {
      const mode = filter.mode ?? "basic";
      return <div className="filter-editor-card advanced-filter-card" data-filter-id={filter.id} key={filter.id}>
        <div className="filter-editor-heading"><strong>{String(filter.field)}</strong><button className="icon-button danger" aria-label={`Remove ${String(filter.field)} filter`} onClick={() => onChange(filters.filter((item) => item.id !== filter.id))}><Trash2 size={12} /></button></div>
        <select aria-label="Filter type" value={mode} onChange={(event) => changeMode(filter, event.target.value as NonNullable<ReportFilterDefinition["mode"]>)}><option value="basic">Basic filter</option><option value="advanced">Advanced clauses</option><option value="topN">Top / Bottom N</option><option value="relativeDate">Relative date</option></select>
        <select aria-label="Filter field" value={filter.field} onChange={(event) => update(filter.id, { field: event.target.value as ReportFilterDefinition["field"] })}>{(mode === "topN" ? dimensions : mode === "relativeDate" ? dates : fields).map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select>
        {mode === "basic" && <><select aria-label="Filter operator" value={filter.operator} onChange={(event) => update(filter.id, { operator: event.target.value as ReportFilterDefinition["operator"] })}>{operatorOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>{!(["isBlank", "isNotBlank"] as const).includes(filter.operator as "isBlank" | "isNotBlank") && <input aria-label="Filter value" value={filter.value} placeholder="Value" onChange={(event) => update(filter.id, { value: event.target.value })} />}</>}
        {mode === "advanced" && <div className="advanced-clause-editor"><label>Combine clauses<select aria-label="Advanced filter logic" value={filter.logicalOperator ?? "and"} onChange={(event) => update(filter.id, { logicalOperator: event.target.value as "and" | "or" })}><option value="and">AND</option><option value="or">OR</option></select></label>{(filter.clauses ?? []).map((clause, index) => <div className="advanced-clause-row" key={index}><select aria-label={`Clause ${index + 1} operator`} value={clause.operator} onChange={(event) => update(filter.id, { clauses: (filter.clauses ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, operator: event.target.value as ReportFilterDefinition["operator"] } : item) })}>{operatorOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>{!(["isBlank", "isNotBlank"] as const).includes(clause.operator as "isBlank" | "isNotBlank") && <input aria-label={`Clause ${index + 1} value`} value={clause.value ?? ""} onChange={(event) => update(filter.id, { clauses: (filter.clauses ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) })} />}{(filter.clauses?.length ?? 0) > 1 && <button className="icon-button danger" aria-label={`Remove clause ${index + 1}`} onClick={() => update(filter.id, { clauses: filter.clauses?.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={11} /></button>}</div>)}<button className="button" type="button" disabled={(filter.clauses?.length ?? 0) >= 5} onClick={() => update(filter.id, { clauses: [...(filter.clauses ?? []), { operator: "equals", value: "" }] })}><Plus size={12} /> Add clause</button></div>}
        {mode === "topN" && <div className="advanced-clause-editor"><label>Direction<select aria-label="Top N direction" value={filter.topN?.direction ?? "top"} onChange={(event) => update(filter.id, { topN: { ...(filter.topN ?? { count: 5, byMeasure: (measures[0]?.key ?? "ActualQty") as keyof ManufacturingRecord }), direction: event.target.value as "top" | "bottom" } })}><option value="top">Top</option><option value="bottom">Bottom</option></select></label><label>Count<input aria-label="Top N count" type="number" min="1" max="1000" value={filter.topN?.count ?? 5} onChange={(event) => update(filter.id, { topN: { ...(filter.topN ?? { direction: "top", byMeasure: (measures[0]?.key ?? "ActualQty") as keyof ManufacturingRecord }), count: Math.max(1, Number(event.target.value)) } })} /></label><label>By measure<select aria-label="Top N measure" value={filter.topN?.byMeasure ?? measures[0]?.key ?? ""} onChange={(event) => update(filter.id, { topN: { ...(filter.topN ?? { direction: "top", count: 5 }), byMeasure: event.target.value as keyof ManufacturingRecord } })}>{measures.map((field) => <option value={field.key} key={field.id}>{field.displayName}</option>)}</select></label><label>Aggregation<select aria-label="Top N aggregation" value={filter.topN?.aggregation ?? "sum"} onChange={(event) => update(filter.id, { topN: { ...(filter.topN ?? { direction: "top", count: 5, byMeasure: (measures[0]?.key ?? "ActualQty") as keyof ManufacturingRecord }), aggregation: event.target.value as Aggregation } })}>{["sum", "average", "minimum", "maximum", "count", "distinctCount"].map((value) => <option key={value}>{value}</option>)}</select></label></div>}
        {mode === "relativeDate" && <div className="advanced-clause-editor"><label>Direction<select aria-label="Relative date direction" value={filter.relativeDate?.direction ?? "last"} onChange={(event) => update(filter.id, { relativeDate: { ...(filter.relativeDate ?? { amount: 30, unit: "days" }), direction: event.target.value as "last" | "next" | "current" } })}><option value="last">Last</option><option value="next">Next</option><option value="current">Current period</option></select></label><label>Amount<input aria-label="Relative date amount" type="number" min="1" max="1000" disabled={filter.relativeDate?.direction === "current"} value={filter.relativeDate?.amount ?? 30} onChange={(event) => update(filter.id, { relativeDate: { ...(filter.relativeDate ?? { direction: "last", unit: "days" }), amount: Math.max(1, Number(event.target.value)) } })} /></label><label>Unit<select aria-label="Relative date unit" value={filter.relativeDate?.unit ?? "days"} onChange={(event) => update(filter.id, { relativeDate: { ...(filter.relativeDate ?? { direction: "last", amount: 30 }), unit: event.target.value as "days" | "weeks" | "months" | "years" } })}><option value="days">Days</option><option value="weeks">Weeks</option><option value="months">Months</option><option value="years">Years</option></select></label><label className="toggle-row"><span>Include today</span><input aria-label="Include today" type="checkbox" checked={filter.relativeDate?.includeToday !== false} onChange={(event) => update(filter.id, { relativeDate: { ...(filter.relativeDate ?? { direction: "last", amount: 30, unit: "days" }), includeToday: event.target.checked } })} /></label></div>}
        <div className="filter-permissions"><label className="toggle-row"><span>Lock for viewers</span><input aria-label="Lock filter" type="checkbox" checked={filter.locked ?? false} onChange={(event) => update(filter.id, { locked: event.target.checked })} /></label><label className="toggle-row"><span>Hide from viewers</span><input aria-label="Hide filter" type="checkbox" checked={filter.hidden ?? false} onChange={(event) => update(filter.id, { hidden: event.target.checked })} /></label></div>
      </div>;
    })}
    {!filters.length && <p className="muted filter-empty">No filters at this scope.</p>}
  </section>;
}
