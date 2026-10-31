import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function syncAndroidAssetsOnBuild() {
  return {
    name: 'lspot-sync-android-assets',
    closeBundle() {
      try {
        const webDistDir = path.resolve(__dirname, 'dist');
        const androidAssetsDir = path.resolve(
          __dirname,
          '../mobile/android/app/src/main/assets/public'
        );
        if (fs.existsSync(webDistDir)) {
          fs.mkdirSync(androidAssetsDir, { recursive: true });
          fs.cpSync(webDistDir, androidAssetsDir, { recursive: true, force: true });
          console.log('✓ [LSpot Auto-Sync] Updated Android APK assets from apps/web/dist');
        }
      } catch (err) {
        console.warn('Warning: could not auto-sync Android assets:', err);
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), syncAndroidAssetsOnBuild()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
