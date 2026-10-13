import type { Metadata } from "next";
import Link from "next/link";
import { FileSearch, ShieldAlert } from "lucide-react";
import { DocumentUploader } from "@/components/document-uploader";
import { DocumentReview, type ReviewDocument, type ReviewExtraction, type ExtractedShape, type ReviewedShape } from "@/components/document-review";
import { db } from "@/lib/data/db";
import { isDemoAdminEnabled } from "@/lib/security/guards";
import { formatDate } from "@/lib/format";
import { first, type SearchParams } from "@/lib/page-params";

export const metadata: Metadata = { title: "Document intelligence" };
export const dynamic = "force-dynamic";

function parse<T>(json: string | null): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  if (!isDemoAdminEnabled()) {
    return (
      <div className="card flex items-start gap-3 p-6">
        <ShieldAlert size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
        <div>
          <h1 className="text-2xl">Document review is disabled here</h1>
          <p className="mt-2 text-sm text-ink-muted">Uploads and review need an authentication layer in production. Set SAFEBITE_ENABLE_DEMO_ADMIN only behind that layer.</p>
        </div>
      </div>
    );
  }

  const [restaurants, recent] = await Promise.all([
    db.restaurant.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } }),
    db.evidenceDocument.findMany({
      orderBy: { uploadedAt: "desc" },
      take: 25,
      include: { restaurant: { select: { name: true } }, source: { select: { label: true } }, extraction: { select: { status: true, errorCode: true } } },
    }),
  ]);

  const selectedId = first(sp.doc);
  const selectedRow = selectedId
    ? await db.evidenceDocument.findUnique({
        where: { id: selectedId },
        include: { restaurant: { select: { name: true } }, source: true, extraction: true },
      })
    : null;

  const doc: ReviewDocument | null = selectedRow
    ? {
        id: selectedRow.id,
        title: selectedRow.title,
        kind: selectedRow.kind,
        restaurantName: selectedRow.restaurant.name,
        sourceLabel: selectedRow.source.label,
        processingStatus: selectedRow.processingStatus,
        fileHref: `/api/documents/${selectedRow.id}/file`,
        publishedInspectionId: null,
      }
    : null;

  const extraction: ReviewExtraction | null = selectedRow?.extraction
    ? {
        status: selectedRow.extraction.status,
        provider: selectedRow.extraction.provider,
        errorCode: selectedRow.extraction.errorCode,
        extracted: parse<ExtractedShape>(selectedRow.extraction.extractedJson),
        reviewed: parse<ReviewedShape>(selectedRow.extraction.reviewedJson),
        reviewerNote: selectedRow.extraction.reviewerNote,
        reviewedAt: selectedRow.extraction.reviewedAt?.toISOString() ?? null,
      }
    : null;

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <p className="eyebrow">Document intelligence</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">Upload, extract, review</h1>
        <p className="mt-3 text-ink-muted">
          Extraction proposes fields from a document. A person checks them against the original, and only then can a record be published. Machine output is never treated as verified.
        </p>
        <ol className="mt-5 grid gap-3 text-sm sm:grid-cols-4">
          {["Upload a PDF", "Run extraction", "Review every field", "Publish with a reviewer note"].map((step, i) => (
            <li key={step} className="card flex items-center gap-3 p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-strong">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </header>

      <DocumentUploader restaurants={restaurants} />

      <section aria-labelledby="recent-heading" className="space-y-4">
        <h2 id="recent-heading" className="text-2xl">Recent documents</h2>
        {recent.length === 0 ? (
          <p className="card p-5 text-sm text-ink-muted">No documents yet. Upload one above or use the sample report.</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Uploaded and sample documents</caption>
              <thead className="border-b border-line bg-sunken/60 text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th scope="col" className="p-3">Title</th>
                  <th scope="col" className="p-3">Restaurant</th>
                  <th scope="col" className="p-3">Source</th>
                  <th scope="col" className="p-3">Status</th>
                  <th scope="col" className="p-3">Extraction</th>
                  <th scope="col" className="p-3">Uploaded</th>
                  <th scope="col" className="p-3"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {recent.map((d) => (
                  <tr key={d.id} className={`border-b border-line last:border-0 ${doc?.id === d.id ? "bg-brand-soft/50" : ""}`}>
                    <td className="p-3 font-medium">{d.title}{d.isSample ? <span className="ml-2 text-xs text-ink-muted">(sample)</span> : null}</td>
                    <td className="p-3">{d.restaurant.name}</td>
                    <td className="p-3 text-ink-muted">{d.source.label}</td>
                    <td className="p-3">{d.processingStatus.toLowerCase()}</td>
                    <td className="p-3">{d.extraction ? `${d.extraction.status.toLowerCase()}${d.extraction.errorCode ? ` (${d.extraction.errorCode})` : ""}` : "not run"}</td>
                    <td className="p-3 text-ink-muted">{formatDate(d.uploadedAt.toISOString().slice(0, 10))}</td>
                    <td className="p-3 text-right">
                      <Link href={`/documents?doc=${d.id}`} className="font-semibold text-brand-strong hover:underline">Review</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {doc ? (
        <section aria-labelledby="review-section" className="space-y-4">
          <h2 id="review-section" className="flex items-center gap-2 text-2xl"><FileSearch size={22} aria-hidden="true" /> Review</h2>
          <DocumentReview doc={doc} extraction={extraction} />
        </section>
      ) : selectedId ? (
        <p role="alert" className="card p-5 text-sm text-critical">That document could not be found.</p>
      ) : null}
    </div>
  );
}
