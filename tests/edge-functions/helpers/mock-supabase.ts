/**
 * Mock Supabase client factory for Edge Function testing.
 * Provides in-memory state for from/select/insert/update/delete/rpc chains.
 */
export function createMockSupabase(initialData: Record<string, any[]> = {}) {
  const data = { ...initialData };
  
  return {
    from: (table: string) => ({
      select: (cols?: string) => ({
        eq: (col: string, val: any) => ({
          single: () => Promise.resolve({ data: (data[table] || []).find(r => r[col] === val) || null, error: null }),
          data: (data[table] || []).filter(r => r[col] === val),
          error: null,
        }),
        data: data[table] || [],
        error: null,
      }),
      insert: (row: any) => {
        if (!data[table]) data[table] = [];
        const rows = Array.isArray(row) ? row : [row];
        data[table].push(...rows);
        return { data: rows, error: null };
      },
      update: (updates: any) => ({
        eq: (col: string, val: any) => {
          const rows = (data[table] || []).filter(r => r[col] === val);
          rows.forEach(r => Object.assign(r, updates));
          return { data: rows, error: null };
        },
      }),
      delete: () => ({
        eq: (col: string, val: any) => {
          data[table] = (data[table] || []).filter(r => r[col] !== val);
          return { data: null, error: null };
        },
      }),
    }),
    rpc: (fn: string, params?: any) => Promise.resolve({ data: null, error: null }),
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, file: any) => Promise.resolve({ data: { path }, error: null }),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.test/${bucket}/${path}` } }),
        createSignedUrl: (path: string, expiresIn: number) => Promise.resolve({ data: { signedUrl: `https://storage.test/${bucket}/${path}?token=mock` }, error: null }),
      }),
    },
  };
}
