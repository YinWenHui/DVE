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
    "--control-border": control.display?.borderColor ?? "var(--border)",
    "--control-border-width": `${control.display?.borderWidth ?? 1}px`,
    borderRadius: control.display?.borderRadius ?? 9,
    fontSize: control.display?.fontSize,
    fontWeight: control.display?.fontWeight === "bold" ? 800 : control.display?.fontWeight === "semibold" ? 650 : 400,
    textAlign: control.display?.textAlignment,
    justifyContent: control.display?.verticalAlignment === "start" ? "flex-start" : control.display?.verticalAlignment === "end" ? "flex-end" : control.display?.verticalAlignment ? "center" : undefined,
  } as CSSProperties;
  const visiblePages = pages.filter((page) => !page.hidden);

  if (control.type === "textBox") return <article className="report-control report-text-object" style={style} aria-label={control.title} data-object-type="textBox"><div>{control.content || control.title}</div></article>;

  if (control.type === "shape") return <div className={`report-control report-shape-object shape-${control.display?.shape ?? "rectangle"}`} style={style} role="img" aria-label={control.altText || control.title} data-object-type="shape" />;

  if (control.type === "image") {
    const imageUrl = control.imageUrl?.trim();
    const imageStyle = { ...style, backgroundImage: imageUrl ? `url(${JSON.stringify(imageUrl)})` : undefined, backgroundSize: control.display?.imageFit ?? "contain" } as CSSProperties;
    return <div className="report-control report-image-object" style={imageStyle} role="img" aria-label={control.altText || control.title} data-object-type="image">{!imageUrl && <span>Image source not configured</span>}</div>;
  }

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
