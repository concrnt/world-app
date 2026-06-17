import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import Info from 'unplugin-info/vite'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), Info()],
    server: {
        host: true,
        allowedHosts: ['host.docker.internal', 'cc2.tunnel.anthrotech.dev']
    }
})
