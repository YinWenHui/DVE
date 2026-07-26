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
