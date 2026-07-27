"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import type { AppSection, DveApplication, Report, RoleCode } from "@/types";

export function AppBuilder({
  reports,
  initial,
}: {
  reports: Report[];
  initial?: DveApplication;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "Untitled application");
  const [slug, setSlug] = useState(initial?.slug ?? "untitled-application");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [publisher, setPublisher] = useState(
    initial?.publisher ?? "Digital Verse Platform Team",
  );
  const [sections, setSections] = useState<AppSection[]>(
    structuredClone(
      initial?.sections ?? [
        {
          id: crypto.randomUUID(),
          name: "Reports",
          ordinal: 0,
          collapsedByDefault: false,
          reportIds: reports[0] ? [reports[0].id] : [],
        },
      ],
    ),
  );
  const [defaultReportId, setDefaultReportId] = useState(
    initial?.defaultReportId ?? reports[0]?.id ?? "",
  );
  const [previewRole, setPreviewRole] = useState("VIEWER");
  const [message, setMessage] = useState<string>();
  const reportMap = new Map(reports.map((report) => [report.id, report]));

  function updateSection(id: string, changes: Partial<AppSection>) {
    setSections((current) =>
      current.map((section) =>
        section.id === id ? { ...section, ...changes } : section,
      ),
    );
  }
  function moveSection(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next.map((section, ordinal) => ({ ...section, ordinal })));
  }
  function addReport(sectionId: string, reportId: string) {
    if (!reportId) return;
    updateSection(sectionId, {
      reportIds: [
        ...new Set([
          ...(sections.find((section) => section.id === sectionId)?.reportIds ??
            []),
          reportId,
        ]),
      ],
    });
  }
  function moveReport(section: AppSection, index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= section.reportIds.length) return;
    const reportIds = [...section.reportIds];
    [reportIds[index], reportIds[target]] = [reportIds[target], reportIds[index]];
    updateSection(section.id, { reportIds });
  }
  async function save(status: DveApplication["status"]) {
    const body = {
      name,
      slug,
      description,
      status,
      publisher,
      defaultReportId,
      sections,
    };
    const response = await fetch(
      initial ? `/api/apps/${initial.id}` : "/api/apps",
      {
        method: initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const payload = (await response.json()) as {
      app?: DveApplication;
      error?: { message?: string };
    };
    setMessage(
      response.ok
        ? `Application ${status === "published" ? "published" : "saved as draft"}.`
        : (payload.error?.message ?? "Save failed."),
    );
    if (response.ok && !initial && payload.app)
      router.push(`/admin/apps/${payload.app.id}/edit`);
  }
  const audienceReportIds = new Set(
    (initial?.audiences ?? [])
      .filter((audience) =>
        audience.roles.includes(previewRole as RoleCode),
      )
      .flatMap((audience) => audience.reportIds),
  );
  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Application setup</h2>
            <p>Identity, publishing state, and contact information.</p>
          </div>
          <div className="table-actions">
            <button className="button" onClick={() => save("draft")}>
              <Save size={15} /> Save draft
            </button>
            <button
              className="button primary"
              onClick={() => save("published")}
            >
              Publish / Update app
            </button>
          </div>
        </div>
        <div className="form-grid">
          <label>
            Name
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!initial)
                  setSlug(
                    event.target.value
                      .toLocaleLowerCase()
                      .replaceAll(/[^a-z0-9]+/g, "-")
                      .replaceAll(/^-|-$/g, ""),
                  );
              }}
            />
          </label>
          <label>
            Slug
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
          </label>
          <label className="full">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label>
            Publisher / contact
            <input
              value={publisher}
              onChange={(event) => setPublisher(event.target.value)}
            />
          </label>
          <label>
            Default landing report
            <select
              value={defaultReportId}
              onChange={(event) => setDefaultReportId(event.target.value)}
            >
              {reports.map((report) => (
                <option value={report.id} key={report.id}>
                  {report.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {message && (
          <p className="status-banner" style={{ marginTop: 12 }}>
            {message}
          </p>
        )}
      </section>
      <div className="form-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Content and navigation</h2>
              <p>Order collapsible sections and assign reports.</p>
            </div>
            <button
              className="button"
              onClick={() =>
                setSections((current) => [
                  ...current,
                  {
                    id: crypto.randomUUID(),
                    name: `Section ${current.length + 1}`,
                    ordinal: current.length,
                    collapsedByDefault: false,
                    reportIds: [],
                  },
                ])
              }
            >
              <Plus size={14} /> Add section
            </button>
          </div>
          <div className="section-editor">
            {sections.map((section, index) => (
              <div className="section-card" key={section.id}>
                <div className="section-card-header">
                  <input
                    value={section.name}
                    onChange={(event) =>
                      updateSection(section.id, { name: event.target.value })
                    }
                  />
                  <div className="table-actions">
                    <button
                      className="icon-button"
                      onClick={() =>
                        updateSection(section.id, {
                          collapsedByDefault: !section.collapsedByDefault,
                        })
                      }
                    >
                      {section.collapsedByDefault ? (
                        <ChevronRight size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => moveSection(index, -1)}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => moveSection(index, 1)}
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      className="icon-button danger"
                      disabled={section.reportIds.length > 0}
                      onClick={() =>
                        setSections((current) =>
                          current.filter((item) => item.id !== section.id),
                        )
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {section.reportIds.map((id, reportIndex) => (
                  <div className="section-report" key={id}>
                    <span>{reportMap.get(id)?.name}</span>
                    <div className="table-actions">
                      <button className="icon-button" title="Move report up" onClick={() => moveReport(section, reportIndex, -1)}><ArrowUp size={13} /></button>
                      <button className="icon-button" title="Move report down" onClick={() => moveReport(section, reportIndex, 1)}><ArrowDown size={13} /></button>
                      <button className="icon-button" title="Remove report" onClick={() => updateSection(section.id, { reportIds: section.reportIds.filter((item) => item !== id) })}><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
                <select
                  defaultValue=""
                  onChange={(event) => {
                    addReport(section.id, event.target.value);
                    event.target.value = "";
                  }}
                >
                  <option value="">Add report…</option>
                  {reports
                    .filter((report) => !section.reportIds.includes(report.id))
                    .map((report) => (
                      <option value={report.id} key={report.id}>
                        {report.name}
                      </option>
                    ))}
                </select>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Audience navigation preview</h2>
              <p>Preview the published menu for a role.</p>
            </div>
            <select
              value={previewRole}
              onChange={(event) => setPreviewRole(event.target.value)}
            >
              <option>VIEWER</option>
              <option>SUPERVISOR</option>
              <option>MANAGER</option>
              <option>ADMINISTRATOR</option>
            </select>
          </div>
          <div
            className="app-sidebar"
            style={{ position: "relative", height: 570, width: "100%" }}
          >
            <div className="sidebar-brand">
              <div className="brand-mark">
                {name
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div className="sidebar-brand-copy">
                <strong>{name}</strong>
                <span>{previewRole} preview</span>
              </div>
            </div>
            <div className="sidebar-scroll">
              {sections.map((section) => (
                <div className="nav-section" key={section.id}>
                  <div className="nav-section-toggle">
                    <ChevronDown size={14} />
                    <span>{section.name}</span>
                  </div>
                  {!section.collapsedByDefault && (
                    <div className="nav-report-list">
                      {section.reportIds
                        .filter(
                          (id) =>
                            previewRole === "ADMINISTRATOR" ||
                            audienceReportIds.size === 0 ||
                            audienceReportIds.has(id),
                        )
                        .map((id) => (
                          <div className="nav-report" key={id}>
                            <span>{reportMap.get(id)?.name}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
