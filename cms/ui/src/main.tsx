import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./style.css";

const root = document.querySelector("#root");
if (!(root instanceof HTMLElement)) {
  throw new Error("React root element was not found");
}

createRoot(root).render(<App />);
