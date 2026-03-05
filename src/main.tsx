import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { initPostHog } from "./lib/posthog";
import App from "./App.tsx";
import "./index.css";

// Initialize PostHog analytics
initPostHog();

// Register service worker for PWA support
registerSW({
  onNeedRefresh() {
    // Could show a toast prompting to refresh
    console.log("New content available, refresh to update.");
  },
  onOfflineReady() {
    console.log("App ready to work offline.");
  },
});

createRoot(document.getElementById("root")!).render(<App />);
