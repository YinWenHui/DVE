import type { DveApplication, Permission, Report, RoleCode, User } from "@/types";

const rolePermissions: Record<RoleCode, Permission[]> = {
  VIEWER: ["apps:read", "reports:read", "datasets:query", "exports:create"],
  SUPERVISOR: ["apps:read", "reports:read", "datasets:query", "exports:create", "comments:create", "alerts:acknowledge"],
  MANAGER: ["apps:read", "reports:read", "datasets:query", "exports:create", "comments:create", "alerts:acknowledge"],
  ADMINISTRATOR: ["apps:read", "reports:read", "datasets:query", "exports:create", "comments:create", "alerts:acknowledge", "admin:manage"],
};

const roleRank: Record<RoleCode, number> = { VIEWER: 0, SUPERVISOR: 1, MANAGER: 2, ADMINISTRATOR: 3 };

export function hasPermission(user: User, permission: Permission): boolean {
  return user.roles.some((role) => rolePermissions[role].includes(permission));
}

export function hasAnyRole(user: User, roles: RoleCode[]): boolean {
  return roles.some((role) => user.roles.includes(role));
}

export function meetsMinimumRole(user: User, role: RoleCode): boolean {
  return user.roles.some((candidate) => roleRank[candidate] >= roleRank[role]);
}

export function visibleReportIds(app: DveApplication, reports: Report[], user: User): Set<string> {
  if (user.roles.includes("ADMINISTRATOR")) return new Set(reports.map((report) => report.id));
  const audienceIds = app.audiences
    .filter((audience) => audience.userIds.includes(user.id) || audience.roles.some((role) => user.roles.includes(role)))
    .flatMap((audience) => audience.reportIds);
  const permitted = reports
    .filter((report) => audienceIds.includes(report.id) && meetsMinimumRole(user, report.minimumRole))
    .map((report) => report.id);
  return new Set(permitted);
}

export function filterAppNavigation(app: DveApplication, reports: Report[], user: User): DveApplication {
  const allowed = visibleReportIds(app, reports, user);
  return {
    ...app,
    sections: app.sections
      .map((section) => ({ ...section, reportIds: section.reportIds.filter((id) => allowed.has(id)) }))
      .filter((section) => section.reportIds.length > 0),
  };
}
