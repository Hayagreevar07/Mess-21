import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative paths for Capacitor Android compatibility
  base: './',
  build: {
    // Code-split for faster initial load
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui': ['lucide-react', 'react-hot-toast'],
        },
      },
    },
    // Increase chunk warning limit
    chunkSizeWarningLimit: 600,
    // Minification
    minify: 'esbuild',
    // Source maps for debugging
    sourcemap: false,
    // Target modern browsers for smaller output
    target: 'es2020',
  },
  // Faster dev server
  server: {
    port: 5173,
    host: true, // Needed for Capacitor live-reload
    strictPort: false,
  },
  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'firebase/app',
      'firebase/auth',
      '@supabase/supabase-js',
      'lucide-react',
      'react-hot-toast',
    ],
  },
})
