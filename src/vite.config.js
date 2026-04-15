import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  base: '/rp-scout/' // This tells Vite exactly where the app lives on GitHub Pages
});
