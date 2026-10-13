import { BadgeCheck, Bot, CircleHelp, ShieldCheck, UserRound } from "lucide-react";
import { TIER_LABELS, type EvidenceTier } from "@/lib/domain";

const STYLE: Record<EvidenceTier, { cls: string; icon: typeof ShieldCheck }> = {
  OFFICIAL_VERIFIED: { cls: "bg-brand-soft text-brand-strong border-brand/30", icon: ShieldCheck },
  INDEPENDENT_CHECK: { cls: "bg-sunken text-ink border-line-strong", icon: BadgeCheck },
  SELF_REPORTED: { cls: "bg-warn-soft text-warn border-warn/30", icon: UserRound },
  UNVERIFIED_ALLEGATION: { cls: "bg-critical-soft text-critical border-critical/30", icon: CircleHelp },
  AI_INFERRED: { cls: "bg-accent-soft text-accent-text border-accent/30", icon: Bot },
};

// Every evidence item carries one of five tiers. The label is always visible; colour never carries meaning alone.
export function EvidenceTierBadge({ tier, compact = false }: { tier: EvidenceTier; compact?: boolean }) {
  const { cls, icon: Icon } = STYLE[tier];
  const meta = TIER_LABELS[tier];
  return (
    <span className={`pill ${cls}`} title={meta.description}>
      <Icon size={13} aria-hidden="true" />
      {compact ? meta.label.split(" ")[0] : meta.label}
    </span>
  );
}
