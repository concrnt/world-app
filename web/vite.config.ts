import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import Info from 'unplugin-info/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        Info(),
        VitePWA({
            registerType: 'prompt',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
            srcDir: 'src',
            filename: 'sw.ts',
            manifest: {
                theme_color: '#0476d9',
                background_color: '#0476d9',
                display: 'standalone',
                scope: '/',
                start_url: '/',
                name: 'Concrnt',
                short_name: 'Concrnt',
                description:
                    'Concrnt is a next-gen decentralized social network platform designed to make your world richer.',
                icons: [
                    {
                        src: '192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'maskable'
                    },
                    {
                        src: '512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable'
                    },
                    {
                        src: 'splash.png',
                        sizes: '300x300',
                        type: 'image/png',
                        purpose: 'any'
                    }
                ],
                screenshots: [
                    {
                        src: 'screenshot_narrow.jpg',
                        type: 'image/jpeg',
                        sizes: '1170x2532',
                        form_factor: 'narrow'
                    },
                    {
                        src: 'screenshot_wide.png',
                        type: 'image/png',
                        sizes: '1419x1260',
                        form_factor: 'wide'
                    }
                ]
            },
            strategies: 'injectManifest',
            injectManifest: {
                maximumFileSizeToCacheInBytes: 10 * 1024 ** 2,
                globPatterns: ['**/*.{css,html}', '**/index*.js']
            },
            devOptions: {
                enabled: true,
                type: 'module'
            }
        })
    ],
    server: {
        host: true,
        allowedHosts: ['host.docker.internal', 'cc2.tunnel.anthrotech.dev']
    }
})
