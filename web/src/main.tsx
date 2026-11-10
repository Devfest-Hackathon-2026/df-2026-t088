import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { loadState } from "./game/storage";
import { PRACTICE_PATH, resolveInitialPath } from "./routing";
import "./styles/tokens.css";
import "./styles/base.css";

// 描く前に道を決めて、島の地図が一瞬映るのを防ぐ。戻るボタンの履歴は増やさない
const initialPath = resolveInitialPath(loadState().sansuSelected, window.location.pathname);
window.history.replaceState(null, "", initialPath === PRACTICE_PATH ? `${initialPath}${window.location.hash}` : initialPath);

const root = document.getElementById("root");
if (!root) throw new Error("#root が見つかりません");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
