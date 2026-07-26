import { describe, expect, it } from "vitest";
import { formatTabularValue, resolvedMatrixRows, resolvedTabularColumns } from "@/lib/tabular";
import type { VisualDefinition } from "@/types";

describe("tabular visual metadata", () => {
  it("uses stable defaults and respects authored field order", () => {
    const table = { id: "table", type: "table", title: "Table", x: 0, y: 0, w: 6, h: 4 } satisfies VisualDefinition;
    expect(resolvedTabularColumns(table).slice(0, 3).map((column) => column.field)).toEqual(["RecordDate", "Line", "Shift"]);
    const matrix: VisualDefinition = { ...table, type: "matrix", tabular: { matrixRows: ["Customer", "Model"], columns: [{ field: "GapQty", label: "Variance" }] } };
    expect(resolvedMatrixRows(matrix)).toEqual(["Customer", "Model"]);
    expect(resolvedTabularColumns(matrix)).toEqual([{ field: "GapQty", label: "Variance" }]);
  });

  it("formats authored number and percentage columns", () => {
    expect(formatTabularValue(1234.56, { field: "ActualQty", format: "number", decimalPlaces: 1 })).toBe("1,234.6");
    expect(formatTabularValue(1.024, { field: "AchievementRate", format: "percent", decimalPlaces: 1 })).toBe("102.4%");
  });
});
