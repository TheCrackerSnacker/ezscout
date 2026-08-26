import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { startSyncListener } from "./offline/sync";
import "./styles.css";

startSyncListener();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
