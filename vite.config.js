import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  // This tells Vite how to read .vue files
  plugins: [vue()],
  
  // This ensures your assets load correctly on GitHub Pages
  base: '/rp-scout/' 
});
