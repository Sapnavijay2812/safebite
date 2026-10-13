// Illustrated fallback artwork. No remote photos are loaded: the demo records are
// fictional, so every restaurant gets a generated tile in its accent colour.

export function RestaurantImage({ name, accent, cuisine, className = "" }: { name: string; accent: string; cuisine: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)` }} role="img" aria-label={`Illustration for ${name}, ${cuisine}`}>
      <svg viewBox="0 0 320 180" className="absolute inset-0 h-full w-full opacity-20" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        <circle cx="260" cy="30" r="70" fill="#fff" />
        <circle cx="40" cy="170" r="90" fill="#fff" opacity="0.5" />
        <path d="M0 140 Q80 110 160 140 T320 130 V180 H0Z" fill="#fff" opacity="0.4" />
      </svg>
      <div className="relative flex h-full w-full items-center justify-center">
        <span className="font-display text-3xl font-semibold text-white/95 drop-shadow-sm" aria-hidden="true">{initials || "SB"}</span>
      </div>
    </div>
  );
}
