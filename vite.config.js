import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Le serveur Express (chatbot Claude) tourne sur le port 3001.
// En dev, Vite proxy toutes les requêtes /api vers ce serveur.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
