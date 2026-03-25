import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages: set base to repo name when deploying
  // Change 'kibbutz-sports' to your actual GitHub repo name
  base: process.env.NODE_ENV === 'production' ? '/Sdy-WC/' : '/',
})
