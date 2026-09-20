import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: resolve(process.cwd(), 'index.html'),
        play: resolve(process.cwd(), 'play/index.html'),
        admin: resolve(process.cwd(), 'admin/index.html'),
        cricketPinball: resolve(process.cwd(), 'cricket-pinball/index.html')
      }
    }
  }
});
