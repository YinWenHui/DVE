export interface AuthoringLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function snapReportLayout<T extends AuthoringLayoutItem>(items: T[], enabled: boolean, step: number, columns = 12): T[] {
  if (!enabled || step <= 1) return items;
  const increment = Math.max(1, Math.min(3, Math.round(step)));
  return items.map((item) => {
    const width = Math.min(columns, Math.max(increment, Math.round(item.w / increment) * increment));
    const height = Math.max(increment, Math.round(item.h / increment) * increment);
    const x = Math.min(columns - width, Math.max(0, Math.round(item.x / increment) * increment));
    const y = Math.max(0, Math.round(item.y / increment) * increment);
    return { ...item, x, y, w: width, h: height };
  });
}

export function createMobileLayout(items: AuthoringLayoutItem[]): AuthoringLayoutItem[] {
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  return [...items].sort((left, right) => left.y - right.y || left.x - right.x).map((item) => {
    const width = item.w <= 3 ? 1 : 2;
    const height = Math.max(1, item.h);
    if (x + width > 2) { y += rowHeight; x = 0; rowHeight = 0; }
    const mobile = { ...item, x, y, w: width, h: height };
    x += width;
    rowHeight = Math.max(rowHeight, height);
    if (x >= 2) { y += rowHeight; x = 0; rowHeight = 0; }
    return mobile;
  });
}

export function nudgeLayoutItem<T extends AuthoringLayoutItem>(item: T, key: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown", resize: boolean, columns: number): T {
  if (resize) {
    const widthChange = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
    const heightChange = key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0;
    const w = Math.max(1, Math.min(columns - item.x, item.w + widthChange));
    const h = Math.max(1, item.h + heightChange);
    return { ...item, w, h };
  }
  const xChange = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
  const yChange = key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0;
  return { ...item, x: Math.max(0, Math.min(columns - item.w, item.x + xChange)), y: Math.max(0, item.y + yChange) };
}
