import { filterAppNavigation } from "@/lib/permissions";
import { getMockStore } from "@/lib/mock-store";
import type { ApplicationRepository, DatasetRepository, ReportRepository } from "./contracts";

export const mockDatasetRepository: DatasetRepository = {
  async list() {
    return structuredClone(getMockStore().datasets);
  },
  async findById(id) {
    return structuredClone(getMockStore().datasets.find((dataset) => dataset.id === id) ?? null);
  },
  async rows(id) {
    return structuredClone(getMockStore().records.get(id) ?? []);
  },
};

export const mockReportRepository: ReportRepository = {
  async list() {
    return structuredClone(getMockStore().reports);
  },
  async findBySlug(slug) {
    return structuredClone(getMockStore().reports.find((report) => report.slug === slug) ?? null);
  },
};

export const mockApplicationRepository: ApplicationRepository = {
  async list(user) {
    const store = getMockStore();
    return structuredClone(store.apps.filter((app) => app.status === "published").map((app) => filterAppNavigation(app, store.reports, user)));
  },
  async findBySlug(slug, user) {
    const store = getMockStore();
    const app = store.apps.find((candidate) => candidate.slug === slug);
    return app ? structuredClone(filterAppNavigation(app, store.reports, user)) : null;
  },
};
