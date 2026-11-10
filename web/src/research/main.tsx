import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ResearchPage } from "./ResearchPage";
import "../styles/tokens.css";
import "../styles/base.css";

// 大人向けのデモ画面の入口。子どもの画面（src/main.tsx）とは別で、子どもの画面の道には触れない
const root = document.getElementById("root");
if (!root) throw new Error("#root が見つかりません");

createRoot(root).render(
  <StrictMode>
    <ResearchPage />
  </StrictMode>,
);
