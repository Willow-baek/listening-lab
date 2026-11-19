import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ensureLocalhost } from "./local-origin";
import "./styles.css";
async function start() {
  const root = document.getElementById("root")!;
  if (new URLSearchParams(location.search).has('guide')) {
    const {default: Guide} = await import('./Guide');
    document.title = 'Listening Lab · 사용 안내';
    createRoot(root).render(<React.StrictMode><Guide/></React.StrictMode>);
    return;
  }
  root.textContent = "재생 환경을 준비하고 있습니다…";
  try {
    if (await ensureLocalhost()) return;
  } catch {
    root.textContent =
      "기록 이전을 완료하지 못했어요. 원래 127.0.0.1 주소의 기록은 보존되어 있습니다. 저장 공간과 연결을 확인한 뒤 다시 열어 주세요.";
    return;
  }
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
void start();
