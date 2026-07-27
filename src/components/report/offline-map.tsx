"use client";

import { useMemo } from "react";
import { aggregateRows } from "@/lib/reporting";
import { thailandGeo } from "@/data/thailand-geo";
import type { ManufacturingRecord, VisualDefinition } from "@/types";

const bounds = { west: 96.7, east: 106.2, north: 21.2, south: 5.1 };
const view = { width: 640, height: 360, inset: 24 };

function project(longitude: number, latitude: number) {
  const width = view.width - view.inset * 2;
  const height = view.height - view.inset * 2;
  return {
    x: view.inset + ((longitude - bounds.west) / (bounds.east - bounds.west)) * width,
    y: view.inset + ((bounds.north - latitude) / (bounds.north - bounds.south)) * height,
  };
}

function polygonPath(coordinates: number[][]) {
  return coordinates.map(([longitude, latitude], index) => {
    const point = project(longitude ?? 0, latitude ?? 0);
    return `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  }).join(" ") + " Z";
}

interface MapPoint {
  key: string;
  location: string;
  latitude: number;
  longitude: number;
  value: number;
}

export function OfflineMap({ visual, rows, selectedValue, onSelect }: { visual: VisualDefinition; rows: ManufacturingRecord[]; selectedValue?: string; onSelect?: (field: keyof ManufacturingRecord | undefined, value: string) => void }) {
  const locationField = visual.geographic?.locationField ?? visual.dimension;
  const latitudeField = visual.geographic?.latitudeField;
  const longitudeField = visual.geographic?.longitudeField;
  const points = useMemo(() => {
    if (!locationField || !latitudeField || !longitudeField || !visual.measure) return [];
    const groups = new Map<string, ManufacturingRecord[]>();
    rows.forEach((row) => {
      const location = String(row[locationField] ?? "Unknown");
      const latitude = Number(row[latitudeField]);
      const longitude = Number(row[longitudeField]);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      const key = `${location}|${latitude}|${longitude}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    });
    return [...groups.entries()].map(([key, group]): MapPoint => ({
      key,
      location: String(group[0]?.[locationField] ?? "Unknown"),
      latitude: Number(group[0]?.[latitudeField]),
      longitude: Number(group[0]?.[longitudeField]),
      value: aggregateRows(group, visual.measure!, visual.aggregation),
    }));
  }, [latitudeField, locationField, longitudeField, rows, visual.aggregation, visual.measure]);
  const maximum = Math.max(1, ...points.map((point) => Math.abs(point.value)));
  const path = polygonPath(thailandGeo.features[0]?.geometry.coordinates[0] ?? []);
  const format = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

  return <div className="offline-map" data-map-source="bundled" data-map-name="thailand">
    <svg viewBox={`0 0 ${view.width} ${view.height}`} role="img" aria-label={`${visual.title}, offline Thailand map with ${points.length} locations`}>
      <defs><linearGradient id={`map-water-${visual.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#eef8ff" /><stop offset="1" stopColor="#dceff8" /></linearGradient></defs>
      <rect width={view.width} height={view.height} rx="10" fill={`url(#map-water-${visual.id})`} />
      <path className="offline-map-land" d={path} />
      <g className="offline-map-grid" aria-hidden="true">{[100, 200, 300, 400, 500].map((x) => <line x1={x} x2={x} y1="0" y2={view.height} key={`x-${x}`} />)}{[90, 180, 270].map((y) => <line x1="0" x2={view.width} y1={y} y2={y} key={`y-${y}`} />)}</g>
      {points.map((point) => {
        const position = project(point.longitude, point.latitude);
        const radius = 6 + Math.sqrt(Math.abs(point.value) / maximum) * 8;
        const selected = selectedValue === point.location;
        return <g className={`offline-map-marker ${selected ? "selected" : ""}`} role="button" tabIndex={0} aria-label={`${point.location}: ${format.format(point.value)}`} transform={`translate(${position.x} ${position.y})`} key={point.key} onClick={() => onSelect?.(locationField, point.location)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect?.(locationField, point.location); } }}>
          <circle r={radius + 5} className="offline-map-marker-halo" />
          <circle r={radius} className="offline-map-marker-core" style={{ fill: visual.display?.accentColor }} />
          <text y={radius + 17}>{point.location}</text>
          <title>{`${point.location}: ${format.format(point.value)}`}</title>
        </g>;
      })}
      <text className="offline-map-label" x="42" y="48">THAILAND</text>
    </svg>
    <div className="offline-map-legend"><span><i /> Marker size: {String(visual.measure ?? "Value")}</span><span>Bundled offline map</span></div>
  </div>;
}
