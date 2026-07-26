"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, CalendarClock, Play, Plus, Trash2, X } from "lucide-react";
import { nextSubscriptionRun, subscriptionCadenceLabel } from "@/lib/report-subscriptions";
import type { ReportSubscriptionDefinition, ReportSubscriptionFormat, ReportSubscriptionFrequency } from "@/types";

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function SubscriptionsPanel({ reportId, userEmail, onPreview }: { reportId: string; userEmail: string; onPreview: (format: ReportSubscriptionFormat) => Promise<void> }) {
  const storageKey = `dve:subscriptions:${reportId}`;
  const [open, setOpen] = useState(false);
  const [subscriptions, setSubscriptions] = useState<ReportSubscriptionDefinition[]>([]);
  const [name, setName] = useState("Morning report");
  const [recipients, setRecipients] = useState(userEmail);
  const [frequency, setFrequency] = useState<ReportSubscriptionFrequency>("daily");
  const [weekday, setWeekday] = useState(1);
  const [monthDay, setMonthDay] = useState(1);
  const [time, setTime] = useState("08:00");
  const [format, setFormat] = useState<ReportSubscriptionFormat>("pdf");
  const [previewing, setPreviewing] = useState<string>();
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Bangkok", []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (stored) setSubscriptions(JSON.parse(stored) as ReportSubscriptionDefinition[]);
      } catch { /* Local privacy settings can disable subscription persistence. */ }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [storageKey]);

  function persist(next: ReportSubscriptionDefinition[]) {
    setSubscriptions(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep the current session usable. */ }
  }

  function addSubscription(event: React.FormEvent) {
    event.preventDefault();
    const addressList = recipients.split(/[;,]/).map((value) => value.trim()).filter(Boolean);
    const subscription: ReportSubscriptionDefinition = {
      id: crypto.randomUUID(), reportId, name: name.trim() || "Scheduled report", recipients: addressList, frequency, weekday: frequency === "weekly" ? weekday : undefined, monthDay: frequency === "monthly" ? monthDay : undefined, time, timezone, format, enabled: true, createdAt: new Date().toISOString(),
    };
    persist([...subscriptions, subscription]);
  }

  async function preview(subscription: ReportSubscriptionDefinition) {
    setPreviewing(subscription.id);
    try { await onPreview(subscription.format); } finally { setPreviewing(undefined); }
  }

  return <>
    <button className="button" aria-haspopup="dialog" onClick={() => setOpen(true)}><BellRing size={14} /> Subscribe{subscriptions.filter((item) => item.enabled).length > 0 ? ` (${subscriptions.filter((item) => item.enabled).length})` : ""}</button>
    {open && <div className="modal-backdrop subscription-backdrop" role="presentation"><section className="subscription-dialog" role="dialog" aria-modal="true" aria-labelledby="subscription-title">
      <header><div><h2 id="subscription-title">Report subscriptions</h2><p>Schedule a filtered PDF or PowerPoint delivery.</p></div><button className="icon-button" aria-label="Close subscriptions" onClick={() => setOpen(false)}><X size={15} /></button></header>
      <div className="subscription-content">
        <form className="subscription-form" onSubmit={addSubscription}>
          <strong><Plus size={14} /> New schedule</strong>
          <label>Name<input aria-label="Subscription name" value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label>Recipients<input aria-label="Subscription recipients" type="text" value={recipients} onChange={(event) => setRecipients(event.target.value)} placeholder="name@example.com; team@example.com" required /></label>
          <div className="subscription-form-grid"><label>Frequency<select aria-label="Subscription frequency" value={frequency} onChange={(event) => setFrequency(event.target.value as ReportSubscriptionFrequency)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>{frequency === "weekly" && <label>Day<select aria-label="Subscription weekday" value={weekday} onChange={(event) => setWeekday(Number(event.target.value))}>{weekdays.map((day, index) => <option value={index} key={day}>{day}</option>)}</select></label>}{frequency === "monthly" && <label>Day of month<input aria-label="Subscription month day" type="number" min="1" max="31" value={monthDay} onChange={(event) => setMonthDay(Math.max(1, Math.min(31, Number(event.target.value))))} /></label>}<label>Time<input aria-label="Subscription time" type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label><label>Attachment<select aria-label="Subscription attachment format" value={format} onChange={(event) => setFormat(event.target.value as ReportSubscriptionFormat)}><option value="pdf">PDF</option><option value="pptx">PowerPoint</option></select></label></div>
          <p>Timezone: <strong>{timezone}</strong>. Delivery execution will use the deployment worker after production operations are enabled.</p>
          <button className="button primary" type="submit"><CalendarClock size={14} /> Add schedule</button>
        </form>
        <div className="subscription-list"><strong>Saved schedules</strong>{subscriptions.map((subscription) => { const next = nextSubscriptionRun(subscription); return <article className="subscription-card" key={subscription.id}><div><span className={`badge ${subscription.enabled ? "healthy" : "draft"}`}>{subscription.enabled ? "active" : "paused"}</span><h3>{subscription.name}</h3><p>{subscriptionCadenceLabel(subscription)} · {subscription.format.toLocaleUpperCase()}</p><small>{subscription.recipients.join(", ")}</small><small>{next ? `Next: ${next.toLocaleString()} (${subscription.timezone})` : "Delivery paused"}</small></div><div className="subscription-actions"><button className="button" type="button" disabled={previewing === subscription.id} onClick={() => void preview(subscription)}><Play size={13} /> {previewing === subscription.id ? "Preparing…" : "Send preview"}</button><button className="button" type="button" onClick={() => persist(subscriptions.map((item) => item.id === subscription.id ? { ...item, enabled: !item.enabled } : item))}>{subscription.enabled ? "Pause" : "Resume"}</button><button className="icon-button danger" aria-label={`Delete subscription ${subscription.name}`} onClick={() => persist(subscriptions.filter((item) => item.id !== subscription.id))}><Trash2 size={13} /></button></div></article>; })}{subscriptions.length === 0 && <div className="empty-state compact">No schedules saved for this report.</div>}</div>
      </div>
    </section></div>}
  </>;
}
