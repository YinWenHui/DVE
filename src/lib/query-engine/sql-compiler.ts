import type { Dataset } from "@/types";
import type { QueryRequest } from "./schema";

export interface CompiledQuery {
  text: string;
  parameters: Array<{ name: string; value: string | number | boolean | null }>;
}

const aggregationSql: Record<QueryRequest["measures"][number]["aggregation"], string> = {
  sum: "SUM",
  average: "AVG",
  minimum: "MIN",
  maximum: "MAX",
  count: "COUNT",
  distinctCount: "COUNT_DISTINCT",
};

function quoteIdentifier(identifier: string): string {
  return "[" + identifier.replaceAll("]", "]]") + "]";
}

export function compileSqlQuery(dataset: Dataset, request: QueryRequest): CompiledQuery {
  const registry = new Map(dataset.fields.map((field) => [field.key, field.sourceName]));
  const identifier = (field: string) => {
    const registered = registry.get(field);
    if (!registered) throw new Error(`Unregistered dataset field: ${field}`);
    return quoteIdentifier(registered);
  };
  const selections = [
    ...request.dimensions.map((dimension) => `${identifier(dimension)} AS ${quoteIdentifier(dimension)}`),
    ...request.measures.map((measure) => {
      const alias = quoteIdentifier(measure.alias ?? `${measure.aggregation}_${measure.field}`);
      if (measure.aggregation === "distinctCount") return `COUNT(DISTINCT ${identifier(measure.field)}) AS ${alias}`;
      return `${aggregationSql[measure.aggregation]}(${identifier(measure.field)}) AS ${alias}`;
    }),
  ];
  const parameters: CompiledQuery["parameters"] = [];
  const clauses = request.filters.map((filter, filterIndex) => {
    const column = identifier(filter.field);
    if (filter.operator === "isNull") return `${column} IS NULL`;
    if (filter.operator === "isNotNull") return `${column} IS NOT NULL`;
    const values = Array.isArray(filter.value) ? filter.value : [filter.value];
    const addParameter = (value: string | number | boolean | null | undefined, valueIndex = 0) => {
      const name = `p${filterIndex}_${valueIndex}`;
      parameters.push({ name, value: value ?? null });
      return `@${name}`;
    };
    if (filter.operator === "in") return `${column} IN (${values.map((value, index) => addParameter(value, index)).join(", ")})`;
    if (filter.operator === "between") return `${column} BETWEEN ${addParameter(values[0])} AND ${addParameter(values[1], 1)}`;
    if (filter.operator === "contains") return `${column} LIKE '%' + ${addParameter(values[0])} + '%'`;
    if (filter.operator === "startsWith") return `${column} LIKE ${addParameter(values[0])} + '%'`;
    const operators = { equals: "=", notEquals: "<>", greaterThan: ">", greaterThanOrEqual: ">=", lessThan: "<", lessThanOrEqual: "<=" } as const;
    return `${column} ${operators[filter.operator]} ${addParameter(values[0])}`;
  });
  const physicalObject = dataset.id.replaceAll(/[^a-zA-Z0-9_]/g, "_");
  const groupBy = request.dimensions.length ? ` GROUP BY ${request.dimensions.map(identifier).join(", ")}` : "";
  const orderBy = request.sort.length ? ` ORDER BY ${request.sort.map((item) => `${identifier(item.field)} ${item.direction.toUpperCase()}`).join(", ")}` : "";
  const text = `SELECT TOP (${Math.min(request.limit, 50_000)}) ${selections.length ? selections.join(", ") : "*"} FROM [dve_data].${quoteIdentifier(physicalObject)}${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""}${groupBy}${orderBy};`;
  return { text, parameters };
}
