import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// The production preview server (Railway) binds to $PORT; dev uses 5173.
// allowedHosts:true lets Railway's *.up.railway.app (and any custom domain)
// reach the preview server — without it Vite 5 rejects unknown Host headers
// with "This host is not allowed", which is the usual first-deploy failure.
export default defineConfig({
    plugins: [react()],
    server: { host: true, port: 5173 },
    preview: {
        host: true,
        port: Number(process.env.PORT) || 4173,
        allowedHosts: true,
    },
    build: {
        chunkSizeWarningLimit: 1600,
        rollupOptions: {
            output: {
                // Keep heavy libraries in their own cacheable chunks. Phaser and xlsx
                // are only pulled in by lazy routes, so this also keeps them out of the
                // initial download.
                manualChunks: function (id) {
                    if (id.includes('node_modules/phaser'))
                        return 'phaser';
                    if (id.includes('node_modules/react-dom') ||
                        id.includes('node_modules/react-router') ||
                        id.includes('node_modules/react/')) {
                        return 'react-vendor';
                    }
                },
            },
        },
    },
});
