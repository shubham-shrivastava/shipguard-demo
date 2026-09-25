import js from "@eslint/js";

const browserGlobals = {
  window: "readonly", document: "readonly", globalThis: "readonly",
  setTimeout: "readonly", clearTimeout: "readonly", requestAnimationFrame: "readonly",
  ShipGuardFilters: "readonly",
  luxon: "readonly",
};
const nodeGlobals = {
  require: "readonly", module: "writable", process: "readonly", __dirname: "readonly", console: "readonly",
  setTimeout: "readonly", fetch: "readonly", URLSearchParams: "readonly",
};
const quotePageGlobals = {
  ...browserGlobals,
  QuoteLogic: "readonly", fetch: "readonly", location: "readonly", history: "readonly",
  sessionStorage: "readonly", URLSearchParams: "readonly", AbortController: "readonly", Intl: "readonly",
};

export default [
  { ignores: ["node_modules/**"] },
  js.configs.recommended,
  {
    files: ["app.js"],
    languageOptions: { sourceType: "script", globals: browserGlobals },
  },
  {
    files: ["filters.js"],
    languageOptions: { sourceType: "script", globals: { ...browserGlobals, module: "readonly" } },
  },
  {
    files: ["quote-logic.js"],
    languageOptions: { sourceType: "script", globals: { ...browserGlobals, module: "readonly" } },
  },
  {
    files: ["quote.js"],
    languageOptions: { sourceType: "script", globals: quotePageGlobals },
  },
  {
    files: ["server.js", "quote-api.js", "quote-data.js", "test/**/*.js"],
    languageOptions: { sourceType: "commonjs", globals: nodeGlobals },
  },
  {
    files: ["legacy-vendor.js", "gauntlet-api.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...nodeGlobals, Buffer: "readonly", URLSearchParams: "readonly" },
    },
  },
  {
    files: ["approvals.js", "grid.js", "wizard.js", "payment.js", "payment-frame.js", "legacy.js", "country-select.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        ...browserGlobals,
        fetch: "readonly", location: "readonly", URLSearchParams: "readonly",
        Intl: "readonly", setInterval: "readonly", clearInterval: "readonly",
        HTMLElement: "readonly", customElements: "readonly", Event: "readonly", CSSStyleSheet: "readonly",
        Number: "readonly", JSON: "readonly",
      },
    },
  },
];
