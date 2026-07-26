export interface BundledGeoFeature {
  type: "Feature";
  properties: { name: string };
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

export interface BundledFeatureCollection {
  type: "FeatureCollection";
  features: BundledGeoFeature[];
}

// Deliberately simplified for fast, offline operational rendering. The reporting
// map never calls a tile server or sends factory coordinates outside the browser.
export const thailandGeo: BundledFeatureCollection = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    properties: { name: "Thailand" },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [97.35, 20.42], [98.55, 20.18], [99.72, 20.32], [100.53, 19.55],
        [101.25, 18.12], [102.12, 17.68], [104.75, 17.44], [105.62, 15.72],
        [104.48, 14.32], [103.18, 14.38], [102.52, 12.18], [101.48, 11.58],
        [101.08, 9.98], [100.42, 7.18], [100.08, 5.62], [99.42, 6.18],
        [99.52, 9.28], [98.42, 10.72], [99.02, 13.28], [98.12, 16.08],
        [97.35, 18.38], [97.35, 20.42],
      ]],
    },
  }],
};
