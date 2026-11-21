import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

/*
 * Content Security Policy for the built site (GitHub Pages can't send security headers, so it goes in a
 * <meta> tag). Build only: the dev server needs inline scripts for hot reload.
 *   script   our own files, plus WebAssembly for the 3D model decoder
 *   connect  our own origin, the Supabase project, a VITALS sensor over WebSocket on the local network,
 *            and blob: (three.js reads the textures packed inside the 3D models that way). The chatbots'
 *            online assistant is the Supabase "chat" Edge Function, on the same Supabase host.
 *   worker   blob: for the 3D model decoder's worker
 * frame-ancestors, HSTS and X-Content-Type-Options need real headers: use a host that sends them if required.
 */
const csp = (supabase: string): Plugin => ({
  name: "vitals-csp",
  apply: "build",
  transformIndexHtml(html) {
    const policy = [
      "default-src 'self'",
      "script-src 'self' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src 'self' blob: ${supabase} ${supabase.replace(/^http/, "ws")} ws: wss:`,
      "worker-src 'self' blob:",
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");
    return html.replace("<title>", `<meta http-equiv="Content-Security-Policy" content="${policy}" />
    <title>`);
  },
});

// base "./" keeps every path relative, so the built site works on GitHub Pages
// and when opened from a plain folder.
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [
    react(),
    csp(loadEnv(mode, process.cwd()).VITE_SUPABASE_URL ?? ""),
    // Vitals 2.0 doesn't need to work offline, so there is no caching service worker. selfDestroying
    // ships a worker that unregisters itself and clears the old caches for anyone who visited the
    // earlier offline build, so nobody is stuck on a stale copy.
    VitePWA({ selfDestroying: true, injectRegister: "script-defer", manifest: false }),
  ],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  server: {
    port: 5190,
  },
}));
