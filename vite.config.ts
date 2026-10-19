import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Never watch large runtime data, backups, or agent scratch files. Locked
      // files in those folders previously caused EBUSY unhandled rejections.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: ['**/.agent/**', '**/.antigravity/**', '**/backups/**', '**/data/**', '**/uploads/**', '**/*.db*', '**/*.log'],
      },
    },
  };
});
