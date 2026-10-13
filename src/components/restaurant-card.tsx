import Link from "next/link";
import { CalendarDays, FileText, MapPin, TriangleAlert } from "lucide-react";
import { RestaurantImage } from "./restaurant-image";
import { CompareToggle } from "./compare-toggle";
import type { RestaurantProfile } from "@/lib/data/types";
import { formatDate } from "@/lib/format";

export function RestaurantCard({ profile }: { profile: RestaurantProfile }) {
  const t = profile.transparency;
  const critical = t.unresolvedOfficial.critical;
  const major = t.unresolvedOfficial.major;
  return (
    <article className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-[0_16px_40px_-18px_rgb(31_36_33/0.25)]">
      <Link href={`/restaurants/${profile.slug}`} className="block" aria-label={`View ${profile.name} safety profile`}>
        <RestaurantImage name={profile.name} accent={profile.accentColor} cuisine={profile.cuisine} className="h-36 w-full" />
      </Link>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{profile.cuisine} · {"$".repeat(profile.priceTier)}</p>
            <h3 className="mt-1 truncate text-xl">
              <Link href={`/restaurants/${profile.slug}`} className="hover:text-brand-strong">{profile.name}</Link>
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
              <MapPin size={14} aria-hidden="true" /> {profile.location.neighborhood}
            </p>
          </div>
          <div className="shrink-0 rounded-2xl bg-brand-soft px-3 py-2 text-center" aria-label={`Evidence confidence ${t.score} out of 100`}>
            <p className="font-display text-2xl font-semibold leading-none text-brand-strong">{t.score}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-brand-strong">Evidence</p>
          </div>
        </div>
        <p className="text-sm font-medium text-ink">{t.label}</p>
        <ul className="grid gap-2 text-sm text-ink-muted">
          <li className="flex items-center gap-2">
            <CalendarDays size={15} aria-hidden="true" />
            {profile.latestInspection
              ? <>Latest official inspection {formatDate(profile.latestInspection.inspectedAt)}</>
              : <>No official inspection on record</>}
          </li>
          <li className="flex items-center gap-2">
            <FileText size={15} aria-hidden="true" />
            {profile.documents.length} document{profile.documents.length === 1 ? "" : "s"} · {6 - t.missingCategories.length}/6 categories with evidence
          </li>
        </ul>
        {critical + major > 0 ? (
          <p className="flex items-center gap-2 rounded-xl bg-critical-soft px-3 py-2 text-xs font-semibold text-critical">
            <TriangleAlert size={14} aria-hidden="true" />
            {critical} critical · {major} major unresolved official finding(s)
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
          <Link href={`/restaurants/${profile.slug}`} className="btn btn-ghost px-3 py-1.5 text-sm">View profile</Link>
          <CompareToggle slug={profile.slug} name={profile.name} />
        </div>
      </div>
    </article>
  );
}
