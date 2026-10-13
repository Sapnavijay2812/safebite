"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Plus, ScanSearch, Trash2, TriangleAlert } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_KEYS, INSPECTION_OUTCOMES, SEVERITIES } from "@/lib/domain";

export interface ReviewDocument {
  id: string;
  title: string;
  kind: string;
  restaurantName: string;
  sourceLabel: string;
  processingStatus: string;
  fileHref: string;
  publishedInspectionId: string | null;
}

export interface ReviewExtraction {
  status: string;
  provider: string;
  errorCode: string | null;
  extracted: ExtractedShape | null;
  reviewed: ReviewedShape | null;
  reviewerNote: string | null;
  reviewedAt: string | null;
}

interface ExtractedFieldShape<T> {
  value: T | null;
  status: "EXTRACTED" | "MISSING";
  confidence: number;
  origin: string;
}

export interface ExtractedShape {
  fields: {
    establishmentName: ExtractedFieldShape<string>;
    inspectionAuthority: ExtractedFieldShape<string>;
    inspectionDate: ExtractedFieldShape<string>;
    overallOutcome: ExtractedFieldShape<string>;
    referenceNumber: ExtractedFieldShape<string>;
  };
  categoriesAssessed: string[];
  findings: Array<{ severity: string; categoryKey: string; description: string; status: string; remediation: string | null }>;
  warnings: string[];
  injectionSuspected: boolean;
  missingFields: string[];
}

export interface ReviewedShape {
  establishmentName?: string | null;
  inspectionAuthority: string;
  inspectionDate: string;
  overallOutcome: string;
  referenceNumber?: string | null;
  categoriesAssessed: string[];
  findings: Array<{ severity: string; categoryKey: string; description: string; status: string; remediation?: string | null }>;
  reviewerNote: string;
}

type Finding = { severity: string; categoryKey: string; description: string; status: string; remediation: string };

export function DocumentReview({ doc, extraction }: { doc: ReviewDocument; extraction: ReviewExtraction | null }) {
  const router = useRouter();
  const seed = extraction?.reviewed ?? null;
  const machine = extraction?.extracted ?? null;

  const [busy, setBusy] = useState<null | "extract" | "save" | "publish">(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [establishmentName, setEstablishmentName] = useState(seed?.establishmentName ?? machine?.fields.establishmentName.value ?? "");
  const [authority, setAuthority] = useState(seed?.inspectionAuthority ?? machine?.fields.inspectionAuthority.value ?? "");
  const [date, setDate] = useState(seed?.inspectionDate ?? machine?.fields.inspectionDate.value ?? "");
  const [outcome, setOutcome] = useState(seed?.overallOutcome ?? machine?.fields.overallOutcome.value ?? "PASS");
  const [reference, setReference] = useState(seed?.referenceNumber ?? machine?.fields.referenceNumber.value ?? "");
  const [categories, setCategories] = useState<string[]>(seed?.categoriesAssessed ?? machine?.categoriesAssessed ?? []);
  const [findings, setFindings] = useState<Finding[]>(
    (seed?.findings ?? machine?.findings ?? []).map((f) => ({
      severity: f.severity,
      categoryKey: f.categoryKey,
      description: f.description,
      status: f.status,
      remediation: f.remediation ?? "",
    })),
  );
  const [note, setNote] = useState(seed?.reviewerNote ?? "");
  const [confirmed, setConfirmed] = useState(false);

  const isPublished = doc.processingStatus === "PUBLISHED";
  const hasExtraction = Boolean(extraction && extraction.status !== "FAILED" && extraction.status !== "PENDING");

  async function runExtraction() {
    setBusy("extract");
    setMessage(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/extract`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as { message?: string; error?: { message: string } } | null;
      if (!res.ok) throw new Error(body?.error?.message ?? "Extraction failed.");
      const extractionBody = body as { status?: string; message?: string | null };
      setMessage({
        tone: extractionBody.status === "FAILED" ? "error" : "ok",
        text: extractionBody.status === "FAILED" ? extractionBody.message ?? "Extraction failed." : "Extraction complete. Check every field against the document before saving.",
      });
      router.refresh();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Extraction failed." });
    } finally {
      setBusy(null);
    }
  }

  async function save(publish: boolean) {
    setBusy(publish ? "publish" : "save");
    setMessage(null);
    const payload = {
      establishmentName: establishmentName || null,
      inspectionAuthority: authority,
      inspectionDate: date,
      overallOutcome: outcome,
      referenceNumber: reference || null,
      categoriesAssessed: categories,
      findings: findings.map((f) => ({ ...f, remediation: f.remediation || null })),
      reviewerNote: note,
      publish,
      confirmHumanReview: confirmed,
    };
    try {
      const res = await fetch(`/api/documents/${doc.id}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as { error?: { message: string; details?: Array<{ path: string; message: string }> } } | null;
      if (!res.ok) {
        const details = body?.error?.details?.map((d) => `${d.path || "form"}: ${d.message}`).join(" · ");
        throw new Error([body?.error?.message, details].filter(Boolean).join(" "));
      }
      setMessage({ tone: "ok", text: publish ? "Published as an inspection record, linked to this document. It is labelled with its source tier." : "Review saved. Nothing is published yet." });
      router.refresh();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Save failed." });
    } finally {
      setBusy(null);
    }
  }

  function updateFinding(index: number, patch: Partial<Finding>) {
    setFindings((list) => list.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Selected document</p>
            <h2 className="mt-1 text-2xl">{doc.title}</h2>
            <p className="mt-1 text-sm text-ink-muted">{doc.restaurantName} · {doc.kind.replace(/_/g, " ").toLowerCase()} · {doc.sourceLabel}</p>
            <p className="mt-2 text-xs text-ink-muted">Status: <strong className="text-ink">{doc.processingStatus.toLowerCase()}</strong></p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="btn btn-secondary px-3 py-2 text-sm" href={doc.fileHref} target="_blank" rel="noopener noreferrer">Open original</a>
            {!isPublished ? (
              <button type="button" className="btn btn-primary px-3 py-2 text-sm" onClick={() => void runExtraction()} disabled={busy !== null}>
                {busy === "extract" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <ScanSearch size={15} aria-hidden="true" />}
                {hasExtraction ? "Re-run extraction" : "Run extraction"}
              </button>
            ) : null}
          </div>
        </div>
        {extraction?.status === "FAILED" ? (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-critical-soft p-3 text-sm text-critical">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            Extraction did not succeed ({extraction.errorCode ?? "unknown"}). You can still enter the values manually after checking the original.
          </p>
        ) : null}
        {machine?.injectionSuspected ? (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-warn-soft p-3 text-sm text-warn">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            The document contains instruction-like text. It was treated as data only. Read it carefully before publishing.
          </p>
        ) : null}
      </section>

      {hasExtraction && machine ? (
        <section className="card p-6" aria-labelledby="machine-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="machine-heading" className="text-lg">Machine-extracted fields</h3>
            <span className="pill bg-accent-soft text-accent-text">{extraction?.provider === "GEMINI" ? "AI-extracted (Gemini, grounded)" : "Rule-extracted (deterministic)"} · not verified</span>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {(Object.entries(machine.fields) as Array<[string, ExtractedFieldShape<string>]>).map(([key, field]) => (
              <div key={key} className="rounded-xl border border-line p-3">
                <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{labelFor(key)}</dt>
                <dd className="mt-1 text-sm">{field.value ?? <span className="text-ink-muted">Missing in document</span>}</dd>
                {field.status === "EXTRACTED" ? <dd className="mt-1 text-xs text-ink-muted">Confidence {Math.round(field.confidence * 100)}%</dd> : null}
              </div>
            ))}
          </dl>
          {machine.warnings.length > 0 ? (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-ink-muted">
              {machine.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          ) : null}
        </section>
      ) : null}

      {hasExtraction && !isPublished ? (
        <form
          className="card grid gap-6 p-6"
          aria-labelledby="review-heading"
          onSubmit={(e) => {
            e.preventDefault();
            void save(false);
          }}
        >
          <div>
            <h3 id="review-heading" className="text-lg">Human review</h3>
            <p className="mt-1 text-sm text-ink-muted">Correct anything that doesn&rsquo;t match the original. Values here become reviewer-confirmed only when you save.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="rv-est" label="Establishment name" value={establishmentName} onChange={setEstablishmentName} />
            <TextField id="rv-auth" label="Inspection authority" value={authority} onChange={setAuthority} required />
            <TextField id="rv-date" label="Inspection date (YYYY-MM-DD)" value={date} onChange={setDate} required placeholder="2026-07-08" />
            <TextField id="rv-ref" label="Reference number" value={reference} onChange={setReference} />
            <div>
              <label className="label" htmlFor="rv-outcome">Overall outcome</label>
              <select id="rv-outcome" className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                {INSPECTION_OUTCOMES.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ").toLowerCase()}</option>)}
              </select>
            </div>
          </div>

          <fieldset>
            <legend className="label">Categories assessed by this report</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {CATEGORY_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={categories.includes(key)}
                    onChange={(e) => setCategories((c) => (e.target.checked ? [...c, key] : c.filter((k) => k !== key)))}
                    className="h-4 w-4 accent-[var(--color-brand)]"
                  />
                  {CATEGORY_LABELS[key]}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Findings</h4>
              <button type="button" className="btn btn-secondary px-3 py-1.5 text-xs" onClick={() => setFindings((f) => [...f, { severity: "MINOR", categoryKey: "CLEANLINESS", description: "", status: "UNRESOLVED", remediation: "" }])}>
                <Plus size={13} aria-hidden="true" /> Add finding
              </button>
            </div>
            {findings.length === 0 ? <p className="mt-2 text-sm text-ink-muted">No findings. Confirm the document really lists none before publishing.</p> : null}
            <ul className="mt-3 grid gap-3">
              {findings.map((f, i) => (
                <li key={i} className="rounded-2xl border border-line p-4">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <SelectField id={`f-sev-${i}`} label="Severity" value={f.severity} options={[...SEVERITIES]} onChange={(v) => updateFinding(i, { severity: v })} />
                    <SelectField id={`f-cat-${i}`} label="Category" value={f.categoryKey} options={[...CATEGORY_KEYS]} labels={CATEGORY_LABELS} onChange={(v) => updateFinding(i, { categoryKey: v })} />
                    <SelectField id={`f-st-${i}`} label="Status" value={f.status} options={["UNRESOLVED", "RESOLVED"]} onChange={(v) => updateFinding(i, { status: v })} />
                    <div className="flex items-end justify-end">
                      <button type="button" className="btn btn-ghost px-3 py-2 text-xs text-critical" onClick={() => setFindings((list) => list.filter((_, j) => j !== i))}>
                        <Trash2 size={13} aria-hidden="true" /> Remove
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <TextField id={`f-desc-${i}`} label="Description (as written in the document)" value={f.description} onChange={(v) => updateFinding(i, { description: v })} />
                    <TextField id={`f-rem-${i}`} label="Remediation (optional)" value={f.remediation} onChange={(v) => updateFinding(i, { remediation: v })} />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label className="label" htmlFor="rv-note">Reviewer note (required, at least 5 characters)</label>
            <textarea id="rv-note" className="input min-h-20" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="submit" className="btn btn-secondary" disabled={busy !== null || note.trim().length < 5}>
              {busy === "save" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
              Save review (does not publish)
            </button>
            {doc.kind === "INSPECTION_REPORT" ? (
              <div className="grid gap-3 rounded-2xl border border-line-strong bg-sunken p-4 sm:max-w-md">
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--color-brand)]" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                  I checked every field against the original document. Publishing creates an inspection record labelled “{doc.sourceLabel}”.
                </label>
                <button type="button" className="btn btn-primary" disabled={busy !== null || !confirmed || note.trim().length < 5} onClick={() => void save(true)}>
                  {busy === "publish" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}
                  Publish reviewed inspection
                </button>
              </div>
            ) : (
              <p className="max-w-sm text-xs text-ink-muted">This document type is kept as reviewed evidence. Only inspection reports can be published as inspection records.</p>
            )}
          </div>
        </form>
      ) : null}

      {isPublished ? (
        <p role="status" className="card flex items-center gap-2 p-4 text-sm text-brand-strong"><CheckCircle2 size={16} aria-hidden="true" /> This document has been published after human review. Its inspection appears on the restaurant profile.</p>
      ) : null}

      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={`rounded-xl p-3 text-sm ${message.tone === "error" ? "bg-critical-soft text-critical" : "bg-brand-soft text-brand-strong"}`}>{message.text}</p>
      ) : null}
    </div>
  );
}

function labelFor(key: string): string {
  const map: Record<string, string> = {
    establishmentName: "Establishment",
    inspectionAuthority: "Inspection authority",
    inspectionDate: "Inspection date",
    overallOutcome: "Overall outcome",
    referenceNumber: "Reference",
  };
  return map[key] ?? key;
}

function TextField({ id, label, value, onChange, required, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} maxLength={500} />
    </div>
  );
}

function SelectField({ id, label, value, options, labels, onChange }: { id: string; label: string; value: string; options: string[]; labels?: Record<string, string>; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{labels?.[o] ?? o.replace(/_/g, " ").toLowerCase()}</option>)}
      </select>
    </div>
  );
}
