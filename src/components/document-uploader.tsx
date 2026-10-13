"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  restaurants: Array<{ slug: string; name: string }>;
}

const MAX_MB = 5;

export function DocumentUploader({ restaurants }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "upload" | "sample">(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function submit(form: FormData) {
    setBusy("upload");
    setMessage(null);
    try {
      const res = await fetch("/api/documents", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as { id?: string; error?: { message: string } } | null;
      if (!res.ok || !body?.id) {
        setMessage({ tone: "error", text: body?.error?.message ?? "Upload failed. Please try again." });
        return;
      }
      setMessage({ tone: "ok", text: "Uploaded. Run extraction to propose the fields for review." });
      router.push(`/documents?doc=${body.id}`);
      router.refresh();
    } catch {
      setMessage({ tone: "error", text: "Network problem during upload." });
    } finally {
      setBusy(null);
    }
  }

  async function loadSample() {
    setBusy("sample");
    setMessage(null);
    try {
      const res = await fetch("/samples/sample-inspection-report.pdf");
      if (!res.ok) throw new Error("missing");
      const blob = await res.blob();
      const file = new File([blob], "sample-inspection-report.pdf", { type: "application/pdf" });
      const form = new FormData();
      form.set("file", file);
      form.set("restaurantSlug", "copperleaf-kitchen");
      form.set("title", "Sample inspection report (simulated)");
      form.set("kind", "INSPECTION_REPORT");
      form.set("sourceKey", "RESTAURANT_SUBMITTED");
      await submit(form);
    } catch {
      setMessage({ tone: "error", text: "The sample report could not be loaded. Run npm run fixtures:pdf." });
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="upload-heading" className="card p-6">
      <h2 id="upload-heading" className="text-xl">Upload an inspection document</h2>
      <p className="mt-1 text-sm text-ink-muted">PDF with a text layer, up to {MAX_MB} MB. Files are checked by content, not just by name. Nothing is published until a reviewer confirms it.</p>
      <form
        className="mt-5 grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          if (!(form.get("file") instanceof File) || (form.get("file") as File).size === 0) {
            setMessage({ tone: "error", text: "Choose a file to upload." });
            return;
          }
          void submit(form);
        }}
      >
        <div>
          <label className="label" htmlFor="doc-restaurant">Restaurant</label>
          <select id="doc-restaurant" name="restaurantSlug" className="input" required defaultValue="copperleaf-kitchen">
            {restaurants.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="doc-title">Title</label>
            <input id="doc-title" name="title" className="input" maxLength={120} placeholder="e.g. Inspection report 2026" required />
          </div>
          <div>
            <label className="label" htmlFor="doc-kind">Document type</label>
            <select id="doc-kind" name="kind" className="input" defaultValue="INSPECTION_REPORT">
              <option value="INSPECTION_REPORT">Inspection report</option>
              <option value="SELF_ATTESTATION">Self-attestation</option>
              <option value="AUDIT_CERTIFICATE">Independent audit summary</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="doc-source">Who produced this document?</label>
          <select id="doc-source" name="sourceKey" className="input" defaultValue="RESTAURANT_SUBMITTED">
            <option value="RESTAURANT_SUBMITTED">Restaurant-submitted (self-reported)</option>
            <option value="INDEPENDENT_AUDIT">Independent auditor (independently checked)</option>
          </select>
          <p className="mt-1 text-xs text-ink-muted">Uploads cannot claim to be official authority records. SafeBite does not verify document authenticity in this demo.</p>
        </div>
        <div>
          <label className="label" htmlFor="doc-file">File</label>
          <input ref={fileRef} id="doc-file" name="file" type="file" accept="application/pdf,image/png,image/jpeg" required className="block w-full rounded-xl border border-dashed border-line-strong bg-surface p-4 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-brand-soft file:px-4 file:py-2 file:font-semibold file:text-brand-strong" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="submit" className="btn btn-primary" disabled={busy !== null}>
            {busy === "upload" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <FileUp size={16} aria-hidden="true" />}
            Upload document
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void loadSample()} disabled={busy !== null}>
            {busy === "sample" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
            Use the sample report
          </button>
        </div>
        {message ? (
          <p role={message.tone === "error" ? "alert" : "status"} className={`rounded-xl p-3 text-sm ${message.tone === "error" ? "bg-critical-soft text-critical" : "bg-brand-soft text-brand-strong"}`}>
            {message.text}
          </p>
        ) : null}
      </form>
    </section>
  );
}
