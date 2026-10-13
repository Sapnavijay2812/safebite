"use client";

import { useState } from "react";
import { Bot, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { SAMPLE_QUESTIONS } from "@/lib/ai/explainer";
import type { ExplainResponse } from "@/lib/ai/explain-service";

interface Props {
  slug: string;
  initialQuestion?: string;
  compareOptions: Array<{ slug: string; name: string }>;
}

type Turn = { question: string; response: ExplainResponse | null; error: string | null };

export function AiExplainer({ slug, initialQuestion = "", compareOptions }: Props) {
  const [question, setQuestion] = useState(initialQuestion);
  const [compareSlug, setCompareSlug] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (trimmed.length < 3) {
      setTurns((t) => [{ question: q, response: null, error: "Ask a question of at least three characters." }, ...t]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantSlug: slug, question: trimmed, ...(compareSlug ? { compareSlug } : {}) }),
      });
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } & Partial<ExplainResponse> | null;
      if (!res.ok || !body || body.error) {
        const message = body?.error?.message ?? "The explainer could not answer right now. Please try again.";
        setTurns((t) => [{ question: trimmed, response: null, error: message }, ...t]);
      } else {
        setTurns((t) => [{ question: trimmed, response: body as ExplainResponse, error: null }, ...t]);
      }
    } catch {
      setTurns((t) => [{ question: trimmed, response: null, error: "Network problem. Check your connection and try again." }, ...t]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="ai-heading" className="card p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong" aria-hidden="true">
          <Bot size={20} />
        </span>
        <div>
          <p className="eyebrow">AI safety explainer</p>
          <h2 id="ai-heading" className="mt-1 text-2xl">Ask about this restaurant&rsquo;s evidence</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Answers cite the records they come from. If the records cannot answer, the explainer says so.
          </p>
        </div>
      </div>

      <form
        className="mt-6 grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <label className="label" htmlFor="ai-question">Your question</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="ai-question"
            className="input"
            value={question}
            maxLength={500}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Are there unresolved violations?"
          />
          <button type="submit" className="btn btn-primary shrink-0" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
            {loading ? "Checking records…" : "Ask"}
          </button>
        </div>
        {compareOptions.length > 0 ? (
          <div>
            <label className="label" htmlFor="ai-compare">Optional: compare with</label>
            <select id="ai-compare" className="input sm:max-w-xs" value={compareSlug} onChange={(e) => setCompareSlug(e.target.value)}>
              <option value="">No comparison</option>
              {compareOptions.map((o) => (
                <option key={o.slug} value={o.slug}>{o.name}</option>
              ))}
            </select>
          </div>
        ) : null}
      </form>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Sample questions</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {SAMPLE_QUESTIONS.map((q) => (
            <li key={q}>
              <button type="button" className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-left text-xs font-medium hover:border-brand hover:text-brand-strong" onClick={() => { setQuestion(q); void ask(q); }}>
                {q}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 space-y-4" aria-live="polite">
        {turns.length === 0 && !loading ? (
          <p className="rounded-2xl bg-sunken p-4 text-sm text-ink-muted">Ask a question or choose a sample to see a grounded answer here.</p>
        ) : null}
        {turns.map((turn, i) => (
          <article key={`${turn.question}-${i}`} className="rounded-2xl border border-line p-4">
            <p className="text-sm font-semibold">{turn.question}</p>
            {turn.error ? (
              <p className="mt-2 flex items-start gap-2 text-sm text-critical"><TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />{turn.error}</p>
            ) : turn.response ? (
              <div className="mt-3">
                <p className={`pill ${turn.response.mode === "GEMINI" ? "bg-brand-soft text-brand-strong" : "bg-neutral-soft text-ink"}`}>
                  {turn.response.modelLabel}
                </p>
                <p className="mt-3 text-sm leading-relaxed">{turn.response.answer}</p>
                {turn.response.insufficientEvidence ? (
                  <p className="mt-2 text-xs font-semibold text-warn">The records do not fully answer this question.</p>
                ) : null}
                {turn.response.citations.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Sources</p>
                    <ul className="mt-1 space-y-1 text-xs">
                      {turn.response.citations.map((c) => (
                        <li key={c.id}>
                          {c.href ? (
                            <a className="text-brand-strong underline underline-offset-2 hover:text-brand" href={c.href}>[{c.id}] {c.label}</a>
                          ) : (
                            <span>[{c.id}] {c.label}</span>
                          )}
                          <span className="text-ink-muted"> · {c.tier.toLowerCase().replace(/_/g, " ")}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <p className="mt-3 text-xs text-ink-muted">{turn.response.notice}</p>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
