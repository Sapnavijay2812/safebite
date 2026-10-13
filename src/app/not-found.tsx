import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-lg space-y-4 p-10 text-center">
      <p className="eyebrow">Not found</p>
      <h1 className="text-3xl">We couldn&rsquo;t find that page</h1>
      <p className="text-sm text-ink-muted">The restaurant or page may not exist in the fictional demo data.</p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Link href="/restaurants" className="btn btn-primary">Explore restaurants</Link>
        <Link href="/" className="btn btn-secondary">Home</Link>
      </div>
    </div>
  );
}
