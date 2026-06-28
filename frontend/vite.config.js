import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

const nm = (pkg) => `node_modules/${pkg}`;

function manualChunks(id) {
  if (!id.includes("node_modules")) return;

  // Keep recharts with lazy Studio Analytics route
  if (id.includes(nm("recharts")) || id.includes("/d3-") || id.includes("/d3/")) return;

  if (id.includes(nm("@xyflow")) || id.includes(nm("@reactflow")) || id.includes(nm("elkjs"))) return "xyflow";
  if (id.includes(nm("@tiptap")) || id.includes("prosemirror")) return "tiptap";
  if (id.includes(nm("framer-motion"))) return "motion";
  if (id.includes(nm("react-router"))) return "router";
  if (id.includes(nm("react-dom")) || id.includes(nm("react/")) || id.includes(nm("scheduler"))) return "react";
  if (id.includes(nm("@tanstack"))) return "query";
  if (id.includes(nm("viem")) || id.includes(nm("wagmi"))) return "evm";
  if (id.includes(nm("@cofhe"))) return "cofhe";

  return "vendor";
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_PROXY_TARGET?.trim() || "http://127.0.0.1:5002";

  return {
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
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
        "/outputs": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
