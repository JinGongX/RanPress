import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import wails from "@wailsio/runtime/plugins/vite";
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: Number(process.env.WAILS_VITE_PORT) || 9245,
    strictPort: true,
  },
  plugins: [vue(), wails("./bindings"),localUploads(),
  ],
});

function localUploads() {
    return {
        name: 'local-uploads',

        configureServer(server: any) {
            const uploadDir = path.join(
                os.homedir(),
                'Library',
                'Application Support',
                'RanPress',
                'uploads'
            )

            server.middlewares.use('/uploads', (req: any, res: any, next: any) => {
                const filename = decodeURIComponent(
                    (req.url || '').split('?')[0].replace(/^\/+/, '')
                )

                const filePath = path.resolve(uploadDir, filename)
                const relativePath = path.relative(uploadDir, filePath)

                // 防止目录穿越
                if (
                    relativePath.startsWith('..') ||
                    path.isAbsolute(relativePath)
                ) {
                    res.statusCode = 403
                    return res.end()
                }

                fs.stat(filePath, (err, stat) => {
                    if (err || !stat.isFile()) {
                        res.statusCode = 404
                        return res.end('Image not found')
                    }

                    const ext = path.extname(filename).toLowerCase()

                    const contentTypes: Record<string, string> = {
                        '.jpg': 'image/jpeg',
                        '.jpeg': 'image/jpeg',
                        '.png': 'image/png',
                        '.gif': 'image/gif',
                        '.webp': 'image/webp',
                        '.svg': 'image/svg+xml'
                    }

                    res.setHeader(
                        'Content-Type',
                        contentTypes[ext] || 'application/octet-stream'
                    )

                    res.setHeader('Content-Length', stat.size)

                    if (req.method === 'HEAD') {
                        return res.end()
                    }

                    fs.createReadStream(filePath).pipe(res)
                })
            })
        }
    }
}