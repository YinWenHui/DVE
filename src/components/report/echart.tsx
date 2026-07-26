"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import * as echarts from "echarts/core";
import { BarChart, FunnelChart, GaugeChart, LineChart, PieChart, ScatterChart, TreemapChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

echarts.use([BarChart, LineChart, PieChart, ScatterChart, GaugeChart, FunnelChart, TreemapChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

export function EChart({ option, onSelect }: { option: EChartsOption; onSelect?: (name: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const onSelectRef = useRef(onSelect);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" }); chartRef.current = chart;
    let resizeFrame = 0; let lastWidth = -1; let lastHeight = -1;
    const resize = () => {
      const element = ref.current; if (!element) return;
      const width = Math.round(element.clientWidth); const height = Math.round(element.clientHeight);
      if (!width || !height || (width === lastWidth && height === lastHeight)) return;
      lastWidth = width; lastHeight = height;
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => chart.resize({ width, height }));
    };
    const select = (event: { name?: string | number }) => {
      if (onSelectRef.current && (typeof event.name === "string" || typeof event.name === "number")) onSelectRef.current(String(event.name));
    };
    resize();
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(ref.current);
    chart.on("click", select);
    return () => { window.cancelAnimationFrame(resizeFrame); resizeObserver.disconnect(); chart.off("click", select); chart.dispose(); chartRef.current = null; };
  }, []);

  useEffect(() => {
    const chart = chartRef.current; if (!chart) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    chart.setOption({ animation: !reduceMotion, animationDuration: 280, animationDurationUpdate: 180, backgroundColor: "transparent", textStyle: { color: resolvedTheme === "dark" ? "#cbd5e1" : "#475569" }, ...option }, { notMerge: true, lazyUpdate: true });
  }, [option, resolvedTheme]);

  return <div ref={ref} style={{ width: "100%", height: "100%" }} role="img" aria-label="Interactive report chart" />;
}
