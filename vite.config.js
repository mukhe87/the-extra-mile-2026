import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// The production preview server (Railway) binds to $PORT; dev uses 5173.
export default defineConfig({
    plugins: [react()],
    server: { host: true, port: 5173 },
    preview: { host: true, port: Number(process.env.PORT) || 4173 },
});
