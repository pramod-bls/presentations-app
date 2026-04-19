import { defineConfig } from 'vite';
import { hotRestartMain } from './vite-hot-restart.mjs';

export default defineConfig({
  plugins: [hotRestartMain('preload')],
});
