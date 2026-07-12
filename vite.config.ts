import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'supabase',
              test: /node_modules[\\/]@supabase[\\/]/,
              priority: 20,
            },
          ],
        },
      },
    },
  },
  server: {
    allowedHosts: true,
    host: '0.0.0.0',
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  preview: {
    allowedHosts: true,
    host: '0.0.0.0',
  },
})
