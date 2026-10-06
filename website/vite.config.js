import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import netlify from '@netlify/vite-plugin';
import {pwaBuild} from './scripts/pwa-build.mjs';
export default defineConfig(({mode})=>({define:{'import.meta.env.VITE_NATIVE_APP':JSON.stringify(mode==='android'?'true':'false')},plugins:[react(),...(mode==='android'?[]:[netlify(),pwaBuild()])],build:{outDir:mode==='android'?'dist-android':'dist'},server:{host:'0.0.0.0',port:5173}}));
