// vite.config.js

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    
    // 👇 ADD THIS LINE TO ALLOW ACCESS FROM THE CLOUDFLARE TUNNEL HOSTNAME
    allowedHosts: [
      'merger-trainer-donor-folder.trycloudflare.com' 
      // Replace with your actual Cloudflare Tunnel URL hostname
    ],
    
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})