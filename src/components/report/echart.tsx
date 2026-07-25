"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

export function EChart({ option, onSelect }: { option: EChartsOption; onSelect?: (name: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" }); chartRef.current = chart;
    const resize = () => chart.resize();
    const animationFrame = window.requestAnimationFrame(resize); window.addEventListener("resize", resize);
    return () => { window.cancelAnimationFrame(animationFrame); window.removeEventListener("resize", resize); chart.dispose(); chartRef.current = null; };
  }, []);

  useEffect(() => {
    const chart = chartRef.current; if (!chart) return;
    chart.setOption({ backgroundColor: "transparent", textStyle: { color: resolvedTheme === "dark" ? "#cbd5e1" : "#475569" }, ...option }, { notMerge: true, lazyUpdate: true });
    chart.off("click");
    chart.on("click", (event) => {
      if (onSelect && (typeof event.name === "string" || typeof event.name === "number")) onSelect(String(event.name));
    });
    return () => { chart.off("click"); };
  }, [onSelect, option, resolvedTheme]);

  return <div ref={ref} style={{ width: "100%", height: "100%" }} role="img" aria-label="Interactive report chart" />;
}
