"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, X, Search } from "lucide-react";
import { CATEGORY_LABELS, REPORT_STATUSES, type ReportStatus } from "@/lib/domain";
import { MIN_MODERATION_NOTE } from "@/lib/moderation/moderation";
import { formatDate } from "@/lib/format";

interface QueueItem {
  id: string;
  restaurantName: string;
  category: string;
  description: string;
  incidentDate: string;
  status: ReportStatus;
  createdAt: string;
  trail: Array<{ from: string; to: string; note: string; at: string }>;
}

const FILTERS: Array<{ value: ReportStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "CORROBORATED", label: "Corroborated" },
  { value: "REJECTED", label: "Rejected" },
];

export function ModerationQueue() {
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [filter, setFilter] = useState<ReportStatus | "ALL">("ALL");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/moderation", { cache: "no-store" });
      const body = (await res.json()) as { items?: QueueItem[]; error?: { message: string } };
      if (!res.ok || !body.items) throw new Error(body.error?.message ?? "Could not load the queue.");
      setItems(body.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the queue.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, toStatus: ReportStatus) {
    setPending(id);
    setError(null);
    try {
      const res = await fetch(`/api/moderation/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus, note: notes[id] ?? "" }),
      });
      const body = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
      if (!res.ok) throw new Error(body?.error?.message ?? "The action could not be completed.");
      setNotes((n) => ({ ...n, [id]: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The action could not be completed.");
    } finally {
      setPending(null);
    }
  }

  if (items === null && !error) {
    return <div className="card flex items-center gap-3 p-6 text-sm text-ink-muted" role="status"><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Loading the moderation queue…</div>;
  }

  const visible = (items ?? []).filter((i) => filter === "ALL" || i.status === filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              role="tab"
              aria-selected={filter === f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${filter === f.value ? "bg-ink text-white" : "bg-surface text-ink-muted border border-line hover:text-ink"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void load()} className="btn btn-secondary px-3 py-2 text-sm">
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </div>

      {error ? <p role="alert" className="rounded-xl bg-critical-soft p-3 text-sm text-critical">{error}</p> : null}

      {visible.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-muted">
          <Search className="mx-auto mb-3" size={22} aria-hidden="true" />
          No reports in this status. Submit one from the community page to see it appear here.
        </div>
      ) : null}

      <ul className="grid gap-4">
        {visible.map((item) => {
          const note = notes[item.id] ?? "";
          const canReview = item.status === "PENDING";
          const canDecide = item.status === "PENDING" || item.status === "UNDER_REVIEW";
          const noteOk = note.trim().length >= MIN_MODERATION_NOTE;
          return (
            <li key={item.id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{item.restaurantName} · {CATEGORY_LABELS[item.category] ?? "Something else"}</p>
                <span className="pill bg-neutral-soft text-ink">{REPORT_STATUSES.includes(item.status) ? item.status.replace("_", " ").toLowerCase() : item.status}</span>
              </div>
              <p className="mt-1 text-xs text-ink-muted">Incident {formatDate(item.incidentDate)} · submitted {formatDate(item.createdAt)} · unverified until corroborated</p>
              <p className="mt-3 text-sm leading-relaxed">{item.description}</p>

              {item.trail.length > 0 ? (
                <ol className="mt-3 space-y-1 border-l-2 border-line pl-3 text-xs text-ink-muted">
                  {item.trail.map((step, i) => (
                    <li key={i}><strong className="text-ink">{step.from} → {step.to}</strong> · {step.note}</li>
                  ))}
                </ol>
              ) : null}

              {canDecide ? (
                <div className="mt-4 grid gap-3 border-t border-line pt-4">
                  <label className="label" htmlFor={`note-${item.id}`}>
                    Moderator note (required to corroborate or reject; at least {MIN_MODERATION_NOTE} characters)
                  </label>
                  <textarea id={`note-${item.id}`} className="input min-h-20" maxLength={500} value={note} onChange={(e) => setNotes((n) => ({ ...n, [item.id]: e.target.value }))} />
                  <div className="flex flex-wrap gap-2">
                    {canReview ? (
                      <button type="button" className="btn btn-secondary px-3 py-2 text-sm" disabled={pending === item.id} onClick={() => void act(item.id, "UNDER_REVIEW")}>Start review</button>
                    ) : null}
                    <button type="button" className="btn btn-primary px-3 py-2 text-sm" disabled={pending === item.id || !noteOk} onClick={() => void act(item.id, "CORROBORATED")}>
                      <Check size={14} aria-hidden="true" /> Corroborate
                    </button>
                    <button type="button" className="btn btn-secondary px-3 py-2 text-sm" disabled={pending === item.id || !noteOk} onClick={() => void act(item.id, "REJECTED")}>
                      <X size={14} aria-hidden="true" /> Reject
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
