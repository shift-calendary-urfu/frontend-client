import { defineConfig, loadEnv } from "vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    server: {
      port: 3000,
      strictPort: true,
      proxy: {
        "/backend": {
          target: env.BACKEND_URL || "http://127.0.0.1:8000",
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/backend/, ""),
        },
      },
    },
  };
});
