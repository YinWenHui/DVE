"use client";

import { memo, type CSSProperties } from "react";
import { ArrowLeft, Bookmark, ExternalLink, RotateCcw } from "lucide-react";
import type { ReportActionDefinition, ReportBookmarkDefinition, ReportControlDefinition, ReportPage } from "@/types";

interface ReportControlProps {
  control: ReportControlDefinition;
  pages: ReportPage[];
  bookmarks: ReportBookmarkDefinition[];
  activePageId?: string;
  activeBookmarkId?: string;
  onAction?: (action: ReportActionDefinition) => void;
}

export const ReportControl = memo(function ReportControl({ control, pages, bookmarks, activePageId, activeBookmarkId, onAction }: ReportControlProps) {
  const style = {
    "--control-accent": control.display?.accentColor ?? "var(--accent)",
    "--control-background": control.display?.backgroundColor ?? "var(--surface)",
    "--control-text": control.display?.textColor ?? "var(--text)",
    borderRadius: control.display?.borderRadius ?? 9,
  } as CSSProperties;
  const visiblePages = pages.filter((page) => !page.hidden);

  if (control.type === "pageNavigator") return <nav className="report-control report-control-navigator" style={style} aria-label={control.title}>
    {visiblePages.map((page) => <button type="button" className={page.id === activePageId ? "active" : ""} aria-current={page.id === activePageId ? "page" : undefined} aria-label={`Open ${page.name} page`} key={page.id} onClick={() => onAction?.({ type: "page", targetId: page.id })}>{page.name}</button>)}
  </nav>;

  if (control.type === "bookmarkNavigator") return <nav className="report-control report-control-navigator bookmark-navigator" style={style} aria-label={control.title}>
    {bookmarks.map((bookmark) => <button type="button" className={bookmark.id === activeBookmarkId ? "active" : ""} aria-pressed={bookmark.id === activeBookmarkId} aria-label={`Apply report bookmark ${bookmark.name}`} key={bookmark.id} onClick={() => onAction?.({ type: "bookmark", targetId: bookmark.id })}><Bookmark size={12} /> {bookmark.name}</button>)}
    {!bookmarks.length && <span>No report bookmarks</span>}
  </nav>;

  const action = control.action ?? { type: "resetFilters" as const };
  const Icon = action.type === "back" ? ArrowLeft : action.type === "bookmark" ? Bookmark : action.type === "resetFilters" ? RotateCcw : ExternalLink;
  return <article className="report-control report-action-control" style={style}>
    <button type="button" aria-label={control.title} onClick={() => onAction?.(action)}><Icon size={15} /><span>{control.title}</span></button>
  </article>;
});
