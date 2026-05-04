import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/web/src/components/message/') || id.includes('/ui/src/ui/CfmRenderer.tsx') || id.includes('/ui/src/ui/Codeblock.tsx')) {
            return 'message-ui'
          }

          if (id.includes('/client/src/') || id.includes('/worldlib/src/')) {
            return 'concrnt-core'
          }

          if (id.includes('/ui/src/')) {
            return 'concrnt-ui'
          }

          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('@rjsf/') || id.includes('react-google-recaptcha') || id.includes('react-qrcode-logo') || id.includes('react-parallax-tilt')) {
            return 'auth-vendor'
          }

          if (id.includes('react-syntax-highlighter') || id.includes('prismjs')) {
            return 'syntax-vendor'
          }

          if (id.includes('react-router-dom') || id.includes('@remix-run/router') || id.includes('react-dom') || id.includes('react') || id.includes('scheduler')) {
            return 'react-vendor'
          }

          if (id.includes('@cosmjs/') || id.includes('@noble/') || id.includes('bech32') || id.includes('elliptic') || id.includes('hash.js')) {
            return 'crypto-vendor'
          }

          return 'vendor'
        }
      }
    }
  },
  server: {
    host: true,
    allowedHosts: [
        'host.docker.internal',
        'cc2.tunnel.anthrotech.dev'
    ]
  }
})
