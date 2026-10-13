import { FlaskConical } from "lucide-react";
import { DEMO_DATA_LABEL } from "@/lib/domain";

export function DemoBanner() {
  return (
    <div role="note" className="bg-ink text-white">
      <p className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center text-xs font-medium sm:px-6 lg:px-8">
        <FlaskConical size={14} aria-hidden="true" className="shrink-0 text-accent" />
        {DEMO_DATA_LABEL}
      </p>
    </div>
  );
}
