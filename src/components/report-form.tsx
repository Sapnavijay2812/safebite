"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/domain";

interface Props {
  restaurants: Array<{ slug: string; name: string }>;
  defaultSlug?: string;
  today: string;
}

const CATEGORY_OPTIONS = [...Object.entries(CATEGORY_LABELS), ["OTHER", "Something else"]] as const;

export function ReportForm({ restaurants, defaultSlug, today }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [description, setDescription] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      restaurantSlug: form.get("restaurantSlug"),
      category: form.get("category"),
      incidentDate: form.get("incidentDate"),
      description: form.get("description"),
      evidenceNote: form.get("evidenceNote") || null,
      website: form.get("website") ?? "",
    };
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as { message?: string; error?: { message?: string } } | null;
      if (res.ok) {
        setResult({ ok: true, text: body?.message ?? "Thanks. Your report was saved as unverified." });
        setDescription("");
        e.currentTarget.reset();
      } else {
        setResult({ ok: false, text: body?.error?.message ?? "We could not save your report. Please check the form." });
      }
    } catch {
      setResult({ ok: false, text: "Network problem. Your report was not saved." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card grid gap-5 p-6 sm:p-8" aria-labelledby="report-heading" noValidate>
      <div>
        <h2 id="report-heading" className="text-2xl">Report a food safety concern</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Reports are saved as <strong>unverified</strong> and reviewed by a moderator. Describe only what you observed. Please don&rsquo;t include personal details about staff or customers.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="rep-restaurant">Restaurant</label>
          <select id="rep-restaurant" name="restaurantSlug" className="input" defaultValue={defaultSlug ?? restaurants[0]?.slug} required>
            {restaurants.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="rep-category">Category</label>
          <select id="rep-category" name="category" className="input" defaultValue="CLEANLINESS" required>
            {CATEGORY_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="rep-date">When did this happen?</label>
          <input id="rep-date" name="incidentDate" type="date" className="input" max={today} required defaultValue={today} />
        </div>
        <div>
          <label className="label" htmlFor="rep-evidence">Evidence you hold (optional)</label>
          <input id="rep-evidence" name="evidenceNote" className="input" maxLength={300} placeholder="e.g. a photo I have, a receipt" />
          <p className="mt-1 text-xs text-ink-muted">Describe it only. Files and links are not uploaded or fetched here.</p>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="rep-description">What did you observe?</label>
        <textarea
          id="rep-description"
          name="description"
          className="input min-h-32"
          maxLength={800}
          required
          minLength={20}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-describedby="rep-count"
        />
        <p id="rep-count" className="mt-1 text-right text-xs text-ink-muted">{description.length}/800</p>
      </div>

      {/* Honeypot: hidden from people and screen readers, filled in only by bots. */}
      <div className="absolute -left-[9999px] h-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="rep-website">Website</label>
        <input id="rep-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-muted">Limited to a few submissions per hour per visitor.</p>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
          Submit as unverified report
        </button>
      </div>

      {result ? (
        <p role={result.ok ? "status" : "alert"} className={`flex items-start gap-2 rounded-xl p-3 text-sm ${result.ok ? "bg-brand-soft text-brand-strong" : "bg-critical-soft text-critical"}`}>
          {result.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> : null}
          {result.text}
        </p>
      ) : null}
    </form>
  );
}
