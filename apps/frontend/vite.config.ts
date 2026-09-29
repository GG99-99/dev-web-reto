import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // Bind IPv4 explicitly. `localhost` resolves to IPv6 (::1) on this machine,
    // and `host: true` does the same on Windows, so 127.0.0.1 (adb reverse and
    // the emulator) would connect and get an empty response.
    host: '0.0.0.0',
    port: Number(process.env.VITE_DEV_PORT || 5173),
     proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    },
  }
})
