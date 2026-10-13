import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { ModerationQueue } from "@/components/moderation-queue";
import { isDemoAdminEnabled } from "@/lib/security/guards";

export const metadata: Metadata = { title: "Moderation (demo)" };
export const dynamic = "force-dynamic";

export default function ModerationPage() {
  if (!isDemoAdminEnabled()) {
    return (
      <div className="card flex items-start gap-3 p-6">
        <ShieldAlert size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
        <div>
          <h1 className="text-2xl">Moderation is disabled here</h1>
          <p className="mt-2 text-sm text-ink-muted">The moderation console requires an authentication layer in production.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="eyebrow">Moderation · demo console</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">Review community reports</h1>
        <p className="mt-3 text-ink-muted">
          Start a review, then corroborate or reject with a note. Every change is recorded in the moderation trail and the audit log. Demo mode has no login, so this page is for local demonstration only.
        </p>
      </header>
      <ModerationQueue />
    </div>
  );
}
