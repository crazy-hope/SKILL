// JSDOM has no layout engine. Keep the real tooltip interaction, but provide
// the browser observer API it expects. Placement is checked in a real browser.
if (typeof window !== "undefined" && typeof ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
