import type { Metadata } from "next";
import Link from "next/link";
import { Filter, LayoutGrid, List, Map as MapIcon, Search } from "lucide-react";
import { RestaurantCard } from "@/components/restaurant-card";
import { MapView } from "@/components/map-view";
import { loadRestaurantProfiles, toDiscoveryRecord } from "@/lib/data/repository";
import { discoverRestaurants, type CoverageFilter, type IndicatorFilter, type InspectionFilter, type SortKey } from "@/lib/discovery/discovery";
import { first, pick, withParams, type SearchParams } from "@/lib/page-params";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Explore restaurants" };
export const dynamic = "force-dynamic";

const COVERAGE: CoverageFilter[] = ["ANY", "STRONG", "GOOD", "PARTIAL", "LIMITED"];
const INSPECTION: InspectionFilter[] = ["ANY", "CURRENT", "AGING", "STALE", "NONE"];
const INDICATOR: IndicatorFilter[] = ["ANY", "NO_OPEN_VIOLATIONS", "OPEN_CRITICAL", "HAS_DOCUMENTS"];
const SORTS: SortKey[] = ["EVIDENCE", "LATEST_INSPECTION", "OPEN_VIOLATIONS", "NAME"];
const PAGE_SIZE = 9;

export default async function RestaurantsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const asOfMs = Date.now();
  const q = first(sp.q)?.slice(0, 100) ?? "";
  const cuisine = first(sp.cuisine) ?? "all";
  const neighborhood = first(sp.neighborhood) ?? "all";
  const coverage = pick(first(sp.coverage), COVERAGE, "ANY");
  const inspection = pick(first(sp.inspection), INSPECTION, "ANY");
  const indicator = pick(first(sp.indicator), INDICATOR, "ANY");
  const sort = pick(first(sp.sort), SORTS, "EVIDENCE");
  const view = first(sp.view) === "map" ? "map" : "list";
  const page = Math.max(1, Number.parseInt(first(sp.page) ?? "1", 10) || 1);

  const profiles = await loadRestaurantProfiles(asOfMs);
  const bySlug = new Map(profiles.map((p) => [p.slug, p]));
  const result = discoverRestaurants(profiles.map(toDiscoveryRecord), {
    q, cuisine, neighborhood, coverage, inspection, indicator, sort, page, pageSize: PAGE_SIZE, asOfMs,
  });
  const filtersActive = Boolean(q) || cuisine !== "all" || neighborhood !== "all" || coverage !== "ANY" || inspection !== "ANY" || indicator !== "ANY";

  const base = { q, cuisine, neighborhood, coverage, inspection, indicator, sort, view };
  // The map shows every match, not just the current page.
  const mapAll = discoverRestaurants(profiles.map(toDiscoveryRecord), { q, cuisine, neighborhood, coverage, inspection, indicator, sort, page: 1, pageSize: 50, asOfMs }).items.map((r) => {
    const p = bySlug.get(r.slug)!;
    return { slug: r.slug, name: r.name, lat: p.location.latitude, lng: p.location.longitude, score: r.evidenceScore, neighborhood: r.neighborhood };
  });

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="eyebrow">Explore</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">Find restaurants by the evidence they can show</h1>
        <p className="mt-3 text-ink-muted">
          Search and filter the fictional demo restaurants. Evidence confidence shows how much verifiable information is on record. Missing evidence is shown as unknown, never as unsafe.
        </p>
      </header>

      <form method="get" action="/restaurants" className="card grid gap-4 p-5 sm:p-6" role="search" aria-label="Filter restaurants">
        <input type="hidden" name="view" value={view} />
        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <label className="label" htmlFor="f-q">Search by name, cuisine or neighbourhood</label>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <input id="f-q" name="q" defaultValue={q} className="input pl-9" placeholder="e.g. taqueria, Harbor Row, vegan" maxLength={100} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="f-cuisine">Cuisine</label>
            <select id="f-cuisine" name="cuisine" defaultValue={cuisine} className="input">
              <option value="all">All cuisines</option>
              {result.facets.cuisines.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-nb">Neighbourhood</label>
            <select id="f-nb" name="neighborhood" defaultValue={neighborhood} className="input">
              <option value="all">All neighbourhoods</option>
              {result.facets.neighborhoods.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="label" htmlFor="f-cov">Evidence coverage</label>
            <select id="f-cov" name="coverage" defaultValue={coverage} className="input">
              <option value="ANY">Any</option>
              <option value="STRONG">Strong (80+)</option>
              <option value="GOOD">Good (60–79)</option>
              <option value="PARTIAL">Partial (40–59)</option>
              <option value="LIMITED">Limited (under 40)</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-insp">Inspection status</label>
            <select id="f-insp" name="inspection" defaultValue={inspection} className="input">
              <option value="ANY">Any</option>
              <option value="CURRENT">Within 6 months</option>
              <option value="AGING">6–12 months</option>
              <option value="STALE">Over 12 months</option>
              <option value="NONE">No official inspection</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-ind">Safety indicator</label>
            <select id="f-ind" name="indicator" defaultValue={indicator} className="input">
              <option value="ANY">Any</option>
              <option value="NO_OPEN_VIOLATIONS">No open critical or major findings</option>
              <option value="OPEN_CRITICAL">Open critical finding</option>
              <option value="HAS_DOCUMENTS">Has documents on file</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-sort">Sort by</label>
            <select id="f-sort" name="sort" defaultValue={sort} className="input">
              <option value="EVIDENCE">Evidence completeness</option>
              <option value="LATEST_INSPECTION">Latest inspection</option>
              <option value="OPEN_VIOLATIONS">Fewest open violations</option>
              <option value="NAME">Name</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary"><Filter size={15} aria-hidden="true" /> Apply filters</button>
          {filtersActive || q ? <Link href={`/restaurants${view === "map" ? "?view=map" : ""}`} className="btn btn-ghost">Clear filters</Link> : null}
          <div className="ml-auto flex items-center gap-1 rounded-full border border-line bg-surface p-1" role="group" aria-label="View">
            <Link href={`/restaurants${withParams(base, { view: "list" })}`} aria-current={view === "list" ? "page" : undefined} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${view === "list" ? "bg-ink text-white" : "text-ink-muted hover:text-ink"}`}>
              <List size={14} aria-hidden="true" /> Cards
            </Link>
            <Link href={`/restaurants${withParams(base, { view: "map" })}`} aria-current={view === "map" ? "page" : undefined} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${view === "map" ? "bg-ink text-white" : "text-ink-muted hover:text-ink"}`}>
              <MapIcon size={14} aria-hidden="true" /> Map
            </Link>
          </div>
        </div>
      </form>

      <p className="text-sm text-ink-muted" aria-live="polite">
        {result.total} restaurant{result.total === 1 ? "" : "s"} match{result.total === 1 ? "es" : ""} · sorted by {sortLabel(sort)}
      </p>

      {result.total === 0 ? (
        <EmptyState title="No restaurants match these filters" body="Try a broader search or clear the filters to see every fictional demo restaurant." action={{ href: "/restaurants", label: "Clear filters" }} />
      ) : view === "map" ? (
        <MapView items={mapAll} />
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-label="Restaurant results">
          {result.items.map((r) => (
            <li key={r.slug}>
              <RestaurantCard profile={bySlug.get(r.slug)!} />
            </li>
          ))}
        </ul>
      )}

      {view === "list" && result.totalPages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-center gap-3">
          {result.page > 1 ? <Link className="btn btn-secondary" href={`/restaurants${withParams(base, { page: result.page - 1 })}`}>Previous</Link> : null}
          <span className="text-sm text-ink-muted">Page {result.page} of {result.totalPages}</span>
          {result.page < result.totalPages ? <Link className="btn btn-secondary" href={`/restaurants${withParams(base, { page: result.page + 1 })}`}>Next</Link> : null}
        </nav>
      ) : null}

      <p className="flex items-center gap-2 text-xs text-ink-muted">
        <LayoutGrid size={13} aria-hidden="true" /> Demo data — fictional restaurants and simulated inspection records. Images are illustrative tiles, not photographs.
      </p>
    </div>
  );
}

function sortLabel(sort: SortKey): string {
  return { EVIDENCE: "evidence completeness", LATEST_INSPECTION: "latest inspection", OPEN_VIOLATIONS: "fewest open violations", NAME: "name" }[sort];
}
