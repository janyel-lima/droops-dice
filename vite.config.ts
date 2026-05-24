import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv} from 'vite';

function fallbackFirebaseConfig() {
  const fileId = 'firebase-applet-config.json';
  return {
    name: 'fallback-firebase-config',
    resolveId(source: string) {
      if (source.endsWith(fileId)) {
        const fullPath = path.resolve(process.cwd(), fileId);
        if (!fs.existsSync(fullPath)) {
          return '\0virtual-firebase-config';
        }
      }
      return null;
    },
    load(id: string) {
      if (id === '\0virtual-firebase-config') {
        return `export default {
          apiKey: "",
          authDomain: "",
          projectId: "",
          storageBucket: "",
          messagingSenderId: "",
          appId: "",
          firestoreDatabaseId: ""
        };`;
      }
      return null;
    }
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: process.env.GH_PAGES === 'true' ? './' : '/',
    plugins: [vue(), tailwindcss(), fallbackFirebaseConfig()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
