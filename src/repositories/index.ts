import { config } from "@/lib/config";
import { mockApplicationRepository, mockDatasetRepository, mockReportRepository } from "./mock";

if (config.DATA_MODE !== "mock" && config.NODE_ENV !== "production") {
  console.warn("SQL repository adapters are configured through migrations but mock repositories remain active in this prototype.");
}

export const repositories = {
  datasets: mockDatasetRepository,
  reports: mockReportRepository,
  applications: mockApplicationRepository,
};
