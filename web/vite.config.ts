import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // 大人向けのデモ画面（research/）と先生の画面（teacher/）を、子どもの画面とは別の入口として配る
  build: {
    rolldownOptions: { input: { main: "index.html", research: "research/index.html", teacher: "teacher/index.html" } },
  },
  // 開発中は /api を server（8080）へ送る。本番の向き先は配信先が決まってから
  // 見本の応答は web/src/pages/print/mocks/ にある。e2e などがリポジトリ直下を読むため、直下まで読ませる
  server: { proxy: { "/api": "http://localhost:8080" }, fs: { allow: [".."] } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
