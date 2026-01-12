import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [{ find: "@", replacement: "/src" }],
  },
  server: {
    host: true, // Hört auf allen Netzwerk-Interfaces, kein localhost notwendig
    port: 5174 // optional, Standardport für Vite
  }
})
