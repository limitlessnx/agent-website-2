export type SupabaseResult<T = unknown> = {
  data: T | null;
  error: Error | null;
};

export type SupabaseQuery<T = unknown> = PromiseLike<SupabaseResult<T>> & {
  select: (columns?: string) => SupabaseQuery<T>;
  eq: (column: string, value: unknown) => SupabaseQuery<T>;
  or: (filters: string) => SupabaseQuery<T>;
  in: (column: string, values: unknown[]) => SupabaseQuery<T>;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQuery<T>;
  limit: (count: number) => SupabaseQuery<T>;
  maybeSingle: () => Promise<SupabaseResult<T>>;
  single: () => Promise<SupabaseResult<T>>;
  upsert: (values: unknown, options?: Record<string, unknown>) => SupabaseQuery<T>;
  insert: (values: unknown) => SupabaseQuery<T>;
  update: (values: unknown) => SupabaseQuery<T>;
  delete: () => SupabaseQuery<T>;
};

export type SupabaseLike = {
  from: <T = unknown>(table: string) => SupabaseQuery<T>;
};

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

export function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.map(asRecord) : [];
}
