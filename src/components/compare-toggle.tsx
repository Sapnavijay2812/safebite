"use client";

import { Check, Plus } from "lucide-react";
import { useCompareSelection, MAX_SELECTION } from "./use-compare-selection";

export function CompareToggle({ slug, name }: { slug: string; name: string }) {
  const { selected, toggle, ready } = useCompareSelection();
  const isOn = selected.includes(slug);
  const full = !isOn && selected.length >= MAX_SELECTION;
  return (
    <button
      type="button"
      onClick={() => toggle(slug)}
      disabled={!ready || full}
      aria-pressed={isOn}
      aria-label={isOn ? `Remove ${name} from comparison` : `Add ${name} to comparison`}
      title={full ? `You can compare up to ${MAX_SELECTION} restaurants` : undefined}
      className={`btn px-3 py-1.5 text-sm ${isOn ? "btn-primary" : "btn-secondary"}`}
    >
      {isOn ? <Check size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
      {isOn ? "Comparing" : "Compare"}
    </button>
  );
}
