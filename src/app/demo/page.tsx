import type { Metadata } from "next";
import Link from "next/link";
import { DEMO_QUESTIONS } from "@/lib/demo/seed-data";
import { DEMO_DATA_LABEL } from "@/lib/domain";
import { SAMPLE_QUESTIONS } from "@/lib/ai/explainer";

export const metadata: Metadata = { title: "Demo guide" };

const STEPS = [
  {
    title: "Explore the fictional restaurants",
    href: "/restaurants",
    action: "Open Explore",
    body: "Search for “taqueria”, filter to Limited evidence, then sort by latest inspection. Switch to Map to see the schematic city.",
  },
  {
    title: "Read a transparent profile",
    href: "/restaurants/copperleaf-kitchen",
    action: "Open Copperleaf Kitchen",
    body: "Check the evidence confidence breakdown, the open MAJOR temperature finding, the inspection timeline and the self-reported document. Notice how a self-attestation that conflicts with an open finding lowers consistency.",
  },
  {
    title: "See a critical violation stay visible",
    href: "/restaurants/tidewater-taqueria",
    action: "Open Tidewater Taqueria",
    body: "The unresolved CRITICAL cross-contamination finding is listed separately from the confidence score, and a corroborated community report is labelled as an allegation.",
  },
  {
    title: "Spot missing evidence",
    href: "/restaurants/lantern-noodle-bar",
    action: "Open Lantern Noodle Bar",
    body: "No official inspection is on record. The profile says unknown, not unsafe, and lists exactly what is missing.",
  },
  {
    title: "Compare two restaurants",
    href: "/compare?slugs=copperleaf-kitchen,saffron-and-stone,bluefin-sushi-house",
    action: "Open a three-way comparison",
    body: "Side-by-side evidence, with observations drawn from the records. There is no ranking.",
  },
  {
    title: "Upload and review a sample inspection report",
    href: "/documents",
    action: "Open Document intelligence",
    body: "Click “Use the sample report”, then “Run extraction”. Check each extracted field against the original, then save the review. Publishing needs the confirmation checkbox.",
  },
  {
    title: "Submit a community report",
    href: "/community",
    action: "Open Report a concern",
    body: "Submit an unverified report. It stays pending until a moderator acts on it in the demo console.",
  },
  {
    title: "Moderate a report",
    href: "/moderation",
    action: "Open the moderation console",
    body: "Start a review, then corroborate or reject with a note of at least 10 characters. Corroborated reports appear on the profile as unverified allegations.",
  },
  {
    title: "Explore the analytics",
    href: "/analytics",
    action: "Open Analytics",
    body: "Every chart is computed from the stored records. Download the export tables to see the BigQuery-ready schema.",
  },
  {
    title: "Understand the scoring",
    href: "/methodology",
    action: "Read the methodology",
    body: "See the tiers, weights, freshness bands and the limitations of the method.",
  },
];

export default function DemoPage() {
  return (
    <div className="space-y-12">
      <header className="max-w-3xl">
        <p className="eyebrow">Demo guide</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">A guided walk through SafeBite</h1>
        <p className="mt-3 text-ink-muted">Everything here runs locally with no accounts or API keys. {DEMO_DATA_LABEL}.</p>
      </header>

      <ol className="grid gap-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft font-display text-lg font-semibold text-brand-strong" aria-hidden="true">{i + 1}</span>
            <div className="flex-1">
              <h2 className="text-lg">{step.title}</h2>
              <p className="mt-1 text-sm text-ink-muted">{step.body}</p>
            </div>
            <Link href={step.href} className="btn btn-secondary shrink-0 px-4 py-2 text-sm">{step.action}</Link>
          </li>
        ))}
      </ol>

      <section aria-labelledby="questions" className="space-y-4">
        <h2 id="questions" className="text-2xl">Sample questions for the AI explainer</h2>
        <p className="text-sm text-ink-muted">Each link opens a restaurant with the question pre-filled. Press Ask to see the cited answer. The demo explainer is a fixed template, not Gemini, unless you configure it.</p>
        <ul className="grid gap-3 md:grid-cols-2">
          {DEMO_QUESTIONS.map((item) => (
            <li key={`${item.slug}-${item.question}`}>
              <Link href={`/restaurants/${item.slug}?q=${encodeURIComponent(item.question)}#ai`} className="card block p-4 text-sm hover:border-brand">
                <span className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">{item.slug.replace(/-/g, " ")}</span>
                <span className="mt-1 block font-medium">{item.question}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-muted">Other questions the explainer answers: {SAMPLE_QUESTIONS.filter((q) => !DEMO_QUESTIONS.some((d) => d.question === q)).join(" · ")}</p>
      </section>
    </div>
  );
}
