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

function hydrateStore(store: Partial<MockStore>): MockStore {
  // The development server keeps this global across hot reloads. Backfill newly
  // introduced fields so an older in-memory shape cannot break a refreshed page.
  store.users ??= structuredClone(mockUsers);
  store.datasets ??= structuredClone([seedDataset]);
  store.reports ??= structuredClone(seedReports);
  store.apps ??= structuredClone([seedApp]);
  store.records ??= new Map([[seedDataset.id, syntheticRecords.map((record) => ({ ...record }))]]);
  store.sessions ??= new Map();
  store.comments ??= [];
  store.alerts ??= structuredClone(seedAlerts);
  store.alertRules ??= structuredClone(seedAlertRules);
  store.audit ??= structuredClone(seedAudit);
  store.refreshRuns ??= [];
  store.pendingImports ??= new Map();
  return store as MockStore;
}

function createStore(): MockStore {
  return hydrateStore({});
}

export function getMockStore(): MockStore {
  globalThis.__digitalVerseMockStore = hydrateStore(globalThis.__digitalVerseMockStore ?? createStore());
  return globalThis.__digitalVerseMockStore;
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function appendAudit(action: string, entityType: string, entityId: string, userDisplayName: string, details: string): void {
  getMockStore().audit.unshift({ id: randomUUID(), action, entityType, entityId, userDisplayName, createdAt: new Date().toISOString(), details });
}
