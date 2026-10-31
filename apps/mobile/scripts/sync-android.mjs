import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDistDir = path.resolve(__dirname, '../../web/dist');
const androidAssetsDir = path.resolve(__dirname, '../android/app/src/main/assets/public');

if (!fs.existsSync(webDistDir)) {
  console.error('Error: apps/web/dist does not exist. Run "pnpm run build" first.');
  process.exit(1);
}

fs.mkdirSync(androidAssetsDir, { recursive: true });
fs.cpSync(webDistDir, androidAssetsDir, { recursive: true, force: true });
console.log(`✓ Synced built web bundle (${webDistDir}) -> Android APK assets (${androidAssetsDir})`);

