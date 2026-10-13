// Helpers for reading Next.js search params on server pages.

export type SearchParams = Record<string, string | string[] | undefined>;

export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

// Builds a query string that keeps current filters and overrides selected keys.
export function withParams(base: SearchParams, overrides: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(base)) {
    const value = first(raw);
    if (value && !(key in overrides)) params.set(key, value);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined && value !== "" && value !== "ANY" && value !== "all") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
