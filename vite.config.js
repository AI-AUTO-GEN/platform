import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// P26 FIX: Copy index.html → 200.html for Surge SPA rewrite support
const surgeSPA = () => ({
  name: 'surge-spa-200',
  closeBundle() {
    const distIndex = resolve('dist', 'index.html')
    if (existsSync(distIndex)) {
      writeFileSync(resolve('dist', '200.html'), readFileSync(distIndex))
    }
  }
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), surgeSPA()],
})
