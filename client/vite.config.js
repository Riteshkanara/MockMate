import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Long-term caching: stable vendor libraries live in their own files, so a
// redeploy that only changes app code doesn't force returning visitors to
// re-download React / the router / framer-motion. (Page code-splitting itself
// is done with React.lazy in App.jsx.)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'router',       test: /node_modules[\\/](react-router|react-router-dom)[\\/]/, priority: 20 },
            { name: 'motion',       test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/, priority: 20 },
          ],
        },
      },
    },
  },
})
