import type { Dataset, DveApplication, Report, User } from "@/types";

export interface DatasetRepository {
  list(user: User): Promise<Dataset[]>;
  findById(id: string, user: User): Promise<Dataset | null>;
  rows(id: string, user: User): Promise<Record<string, unknown>[]>;
}

export interface ReportRepository {
  list(user: User): Promise<Report[]>;
  findBySlug(slug: string, user: User): Promise<Report | null>;
}

export interface ApplicationRepository {
  list(user: User): Promise<DveApplication[]>;
  findBySlug(slug: string, user: User): Promise<DveApplication | null>;
}
