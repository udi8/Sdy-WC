import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Firebase Hosting serves from root — no base path needed
  base: '/',
})
