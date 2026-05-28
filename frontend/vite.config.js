import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

const nm = (pkg) => `node_modules/${pkg}`;

/** Split heavy node_modules; avoid circular deps (react/polyfills must not pull vendor). */
function manualChunks(id) {
  if (!id.includes("node_modules")) return;

  if (id.includes(nm("algosdk"))) return "algosdk";
  if (id.includes(nm("@perawallet"))) return "pera";

  if (
    id.includes(nm("vite-plugin-node-polyfills")) ||
    id.includes(nm("node-stdlib-browser")) ||
    id.includes(nm("crypto-browserify")) ||
    id.includes(nm("stream-browserify")) ||
    id.includes(nm("buffer/")) ||
    id.includes(nm("vm-browserify")) ||
    id.includes(nm("browserify-")) ||
    id.includes(nm("process/"))
  ) {
    return "polyfills";
  }

  if (id.includes(nm("@xyflow")) || id.includes(nm("@reactflow")) || id.includes(nm("elkjs"))) return "xyflow";
  if (id.includes(nm("@tiptap")) || id.includes("prosemirror")) return "tiptap";
  if (id.includes(nm("recharts")) || id.includes(nm("d3-"))) return "recharts";
  if (id.includes(nm("framer-motion"))) return "motion";
  if (id.includes(nm("react-router"))) return "router";
  if (id.includes(nm("react-dom")) || id.includes(nm("react/")) || id.includes(nm("scheduler"))) return "react";
  if (id.includes(nm("@tanstack"))) return "query";

  return "vendor";
}

export default defineConfig({
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  build: {
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],
  define: {
    global: "globalThis",
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
    },
  },
});
