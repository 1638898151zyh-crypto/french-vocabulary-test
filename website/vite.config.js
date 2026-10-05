import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import netlify from '@netlify/vite-plugin';
import {pwaBuild} from './scripts/pwa-build.mjs';
export default defineConfig({plugins:[react(),netlify(),pwaBuild()],server:{host:'0.0.0.0',port:5173}});
