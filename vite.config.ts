import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react-vendor'
          }

          if (
            id.includes('node_modules/framer-motion/')
          ) {
            return 'motion-vendor'
          }

          if (
            id.includes('node_modules/lucide-react/')
          ) {
            return 'icons-vendor'
          }

          if (
            id.includes('node_modules/three/')
          ) {
            return 'three-vendor'
          }

          if (
            id.includes(
              'node_modules/@react-three/fiber/',
            )
          ) {
            return 'r3f-vendor'
          }

          return undefined
        },
      },
    },
  },
})