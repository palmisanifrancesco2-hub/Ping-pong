import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { browserSupabaseConfig } from './server/build-config';
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const config = browserSupabaseConfig(env);
  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(config?.url ?? ''),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(config?.key ?? ''),
    },
    server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
    build: { sourcemap: false },
  };
});
