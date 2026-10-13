import Link from "next/link";

// Schematic map of the fictional demo city. Positions are relative coordinates
// stored in the database (0..1). No map tiles or paid mapping APIs are used.
export function MapView({ items }: { items: Array<{ slug: string; name: string; lat: number; lng: number; score: number; neighborhood: string }> }) {
  return (
    <div className="card overflow-hidden p-4">
      <svg viewBox="0 0 1000 700" role="img" aria-label="Schematic map of Harbor Bay demo restaurants" className="h-auto w-full rounded-2xl bg-sunken">
        <rect width="1000" height="700" fill="#F3EEE4" />
        <path d="M0 520 C 180 470, 300 580, 480 540 S 760 470, 1000 560 L1000 700 L0 700Z" fill="#D7E6EE" />
        <g stroke="#E6DFD3" strokeWidth="14" fill="none" strokeLinecap="round">
          <path d="M60 120 H940" />
          <path d="M80 300 H920" />
          <path d="M200 40 V480" />
          <path d="M520 60 V620" />
          <path d="M800 80 V560" />
        </g>
        <text x="80" y="95" fontSize="22" fill="#56605A" fontFamily="inherit">Old Mill</text>
        <text x="620" y="95" fontSize="22" fill="#56605A">Market Quarter</text>
        <text x="80" y="330" fontSize="22" fill="#56605A">Garden District</text>
        <text x="620" y="330" fontSize="22" fill="#56605A">Canal Side</text>
        <text x="80" y="650" fontSize="20" fill="#3A6B86">Harbor</text>
      </svg>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.slug}>
            <Link href={`/restaurants/${item.slug}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm hover:border-brand">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{item.name}</span>
                <span className="block text-xs text-ink-muted">{item.neighborhood}</span>
              </span>
              <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-strong">{item.score}/100</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-muted">Schematic only. Positions are illustrative for this fictional city and are not addresses.</p>
    </div>
  );
}
