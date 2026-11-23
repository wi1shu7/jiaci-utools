import { copyFile, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const hostFiles = ["plugin.json", "preload.js", "float-preload.js", "api.js", "study.js", "pronunciation.js", "logo.png"]
const pages = ["index.html", "float.html"]

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "utools-package",
      async writeBundle({ dir }) {
        await Promise.all([
          ...hostFiles.map((file) => copyFile(file, resolve(dir, file))),
          ...pages.map(async (page) => {
            const html = await readFile(page, "utf8")
            await writeFile(resolve(dir, page), html.replaceAll("./dist/", "./"))
          }),
        ])
      },
    },
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    target: "chrome132",
    lib: {
      entry: "src/entry.jsx",
      name: "JiaciRenderer",
      formats: ["iife"],
      fileName: () => "renderer.js",
      cssFileName: "renderer",
    },
  },
})
