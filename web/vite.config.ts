import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import Info from 'unplugin-info/vite'
import { VitePWA } from 'vite-plugin-pwa'

// 本番と見分けられるよう、dev サーバーと CONCRNT_DEV_BUILD=1 のビルドではアイコンを黄色版に差し替える
const devIconsDir = path.resolve(import.meta.dirname, 'devpublic')
const devIconNames = fs.readdirSync(devIconsDir)
const devIcons: Plugin = {
    name: 'concrnt-dev-icons',
    configureServer(server) {
        server.middlewares.use((req, res, next) => {
            const name = req.url?.split('?')[0].slice(1) ?? ''
            if (!devIconNames.includes(name)) return next()
            res.setHeader('Content-Type', name.endsWith('.ico') ? 'image/x-icon' : 'image/png')
            res.setHeader('Cache-Control', 'no-cache')
            fs.createReadStream(path.join(devIconsDir, name)).pipe(res)
        })
    },
    writeBundle(options) {
        if (process.env.CONCRNT_DEV_BUILD !== '1' || !options.dir) return
        for (const name of devIconNames) {
            fs.copyFileSync(path.join(devIconsDir, name), path.join(options.dir, name))
        }
    }
}

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        devIcons,
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
                globPatterns: ['**/*.{css,html}', '**/index*.js', '**/*.woff2']
            },
            devOptions: {
                enabled: true,
                type: 'module'
            }
        })
    ],
    resolve: {
        dedupe: ['react', 'react-dom', 'react/jsx-runtime']
    },
    build: {
        // client/worldlib の `require('ws')` は Node 専用分岐。rolldown は静的に解決しに行くので外す
        rolldownOptions: {
            external: ['ws']
        }
    },
    server: {
        host: true,
        allowedHosts: ['host.docker.internal', 'cc2.tunnel.anthrotech.dev']
    }
})
