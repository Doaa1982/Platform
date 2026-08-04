import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* The API URL is injected by .NET Aspire via `.WithReference(api)` in
   Platform.AppHost. Falling back to the launchSettings http port keeps
   `npm run dev` working on its own, outside Aspire. */
const apiTarget =
  process.env.services__api__https__0 ||
  process.env.services__api__http__0 ||
  'http://localhost:5082'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.VITE_PORT) || 3000,
    proxy: {
      // Proxying keeps the browser same-origin, so no CORS preflight and no
      // backend port baked into client code.
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        // Aspire's https endpoint uses the local dev certificate
        secure: false,
      },
    },
  },
})
