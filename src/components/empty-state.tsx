import Link from "next/link";
import { Inbox } from "lucide-react";

export function EmptyState({ title, body, action }: { title: string; body: string; action?: { href: string; label: string } }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sunken text-ink-muted" aria-hidden="true">
        <Inbox size={22} />
      </span>
      <h2 className="text-xl">{title}</h2>
      <p className="max-w-md text-sm text-ink-muted">{body}</p>
      {action ? <Link href={action.href} className="btn btn-secondary mt-2">{action.label}</Link> : null}
    </div>
  );
}
