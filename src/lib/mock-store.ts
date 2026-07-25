import { createHash, randomUUID } from "node:crypto";
import { mockUsers, seedAlertRules, seedAlerts, seedApp, seedAudit, seedDataset, seedReports, syntheticRecords } from "@/data/seed";
import type { AlertEvent, AlertRule, AuditRecord, CommentRecord, Dataset, DveApplication, Report, User } from "@/types";

interface MockSession {
  userId: string;
  expiresAt: number;
  revokedAt?: number;
}

export interface MockStore {
  users: User[];
  datasets: Dataset[];
  reports: Report[];
  apps: DveApplication[];
  records: Map<string, Record<string, unknown>[]>;
  sessions: Map<string, MockSession>;
  comments: CommentRecord[];
  alerts: AlertEvent[];
  alertRules: AlertRule[];
  audit: AuditRecord[];
  refreshRuns: Array<{ id: string; datasetId: string; status: "running" | "succeeded" | "failed"; startedAt: string; completedAt?: string; rowsWritten?: number; errorMessage?: string }>;
  pendingImports: Map<string, { fileName: string; sourceType: "excel" | "csv"; rows: Record<string, unknown>[] }>;
}

declare global {
  var __digitalVerseMockStore: MockStore | undefined;
}

function createStore(): MockStore {
  return {
    users: structuredClone(mockUsers),
    datasets: structuredClone([seedDataset]),
    reports: structuredClone(seedReports),
    apps: structuredClone([seedApp]),
    records: new Map([[seedDataset.id, syntheticRecords.map((record) => ({ ...record }))]]),
    sessions: new Map(),
    comments: [],
    alerts: structuredClone(seedAlerts),
    alertRules: structuredClone(seedAlertRules),
    audit: structuredClone(seedAudit),
    refreshRuns: [],
    pendingImports: new Map(),
  };
}

export function getMockStore(): MockStore {
  globalThis.__digitalVerseMockStore ??= createStore();
  return globalThis.__digitalVerseMockStore;
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function appendAudit(action: string, entityType: string, entityId: string, userDisplayName: string, details: string): void {
  getMockStore().audit.unshift({ id: randomUUID(), action, entityType, entityId, userDisplayName, createdAt: new Date().toISOString(), details });
}
