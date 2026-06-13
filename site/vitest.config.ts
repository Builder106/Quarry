import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Component tests for the Next.js site. jsdom + RTL; globals:true so RTL's
// automatic per-test cleanup hooks register. We deliberately avoid jest-dom
// matchers and use plain DOM assertions so `tsc --noEmit` stays green without
// extra type plumbing.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["app/**/*.test.{ts,tsx}", "components/**/*.test.{ts,tsx}"],
  },
});
