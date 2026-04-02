/**
 * @module tests/edge-functions/helpers/mock-supabase.ts
 * @status TEST
 * @lastReview 2026-03-28
 * Mock Supabase client factory for Edge Function testing.
 * Provides in-memory state for from/select/insert/update/delete/rpc chains.
 */
type Row = Record<string, unknown>;

export function createMockSupabase(initialData: Record<string, Row[]> = {}) {
  const data: Record<string, Row[]> = { ...initialData };

  return {
    from: (table: string) => ({
      select: (_cols?: string) => ({
        eq: (col: string, val: unknown) => ({
          single: () =>
            Promise.resolve({
              data: (data[table] || []).find((r) => r[col] === val) || null,
              error: null,
            }),
          data: (data[table] || []).filter((r) => r[col] === val),
          error: null,
        }),
        data: data[table] || [],
        error: null,
      }),
      insert: (row: Row | Row[]) => {
        if (!data[table]) data[table] = [];
        const rows = Array.isArray(row) ? row : [row];
        data[table].push(...rows);
        return { data: rows, error: null };
      },
      update: (updates: Row) => ({
        eq: (col: string, val: unknown) => {
          const rows = (data[table] || []).filter((r) => r[col] === val);
          rows.forEach((r) => Object.assign(r, updates));
          return { data: rows, error: null };
        },
      }),
      delete: () => ({
        eq: (col: string, val: unknown) => {
          data[table] = (data[table] || []).filter((r) => r[col] !== val);
          return { data: null, error: null };
        },
      }),
    }),
    rpc: (_fn: string, _params?: unknown) => Promise.resolve({ data: null, error: null }),
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, _file: unknown) => Promise.resolve({ data: { path }, error: null }),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.test/${bucket}/${path}` } }),
        createSignedUrl: (path: string, expiresIn: number) => Promise.resolve({ data: { signedUrl: `https://storage.test/${bucket}/${path}?token=mock` }, error: null }),
      }),
    },
  };
}
