import { createRoot } from "react-dom/client";

import "./style.css";

function App() {
  return (
    <main className="shell">
      <p className="eyebrow">CMS-R001</p>
      <h1>Blog CMS</h1>
      <p>React 19 / Viteによる移行基盤が動作しています。</p>
      <p>記事機能は移行完了まで従来のCMSで利用できます。</p>
      <a href="/">従来のCMSへ戻る</a>
    </main>
  );
}

const root = document.querySelector("#root");
if (!(root instanceof HTMLElement)) {
  throw new Error("React root element was not found");
}

createRoot(root).render(<App />);
