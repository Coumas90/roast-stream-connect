// src/lib/env.ts
export type EnvResult = {
  url?: string;
  key?: string;
  missing: string[];
  source: 'env' | 'runtime';
};

export function loadEnv(): EnvResult {
  // 1) Variables de build (Vite)
  let url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  let key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  // 2) Overrides de runtime (localStorage) sólo en DEV o si se habilita explícitamente
  const allowRuntime =
    import.meta.env.DEV ||
    (import.meta.env.VITE_ALLOW_RUNTIME_ENV as any) === 'true';

  if (allowRuntime) {
    const runtimeUrl = localStorage.getItem('__DEV_SUPABASE_URL') || undefined;
    const runtimeKey = localStorage.getItem('__DEV_SUPABASE_ANON_KEY') || undefined;
    url = runtimeUrl || url;
    key = runtimeKey || key;
  }

  const missing: string[] = [];
  if (!url) missing.push('VITE_SUPABASE_URL');
  if (!key) missing.push('VITE_SUPABASE_ANON_KEY');

  return { url, key, missing, source: allowRuntime ? 'runtime' : 'env' };
}

export function requireEnv(): { url: string; key: string } {
  const { url, key, missing } = loadEnv();
  const msg = `Missing env vars: ${missing.join(', ')}. ` +
              `Set them in project envs OR use /env-setup.html to load runtime overrides.`;
  if (missing.length) {
    if (import.meta.env.DEV) {
      console.warn(msg);
    } else {
      throw new Error(msg);
    }
  }
  return { url: url!, key: key! };
}