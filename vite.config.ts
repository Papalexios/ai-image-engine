import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          // FIX: `__dirname` is not available in ES modules. Using `path.resolve('.')` to get the project root.
          '@': path.resolve('.'),
        }
      }
    };
});