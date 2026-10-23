// The rules of ESLint's "recommended" set (@eslint/js 9.39), written out so
// the config needs no installed package and runs with a bare `npx eslint`.
const recommended = {
  rules: {
    "constructor-super": "error",
    "for-direction": "error",
    "getter-return": "error",
    "no-async-promise-executor": "error",
    "no-case-declarations": "error",
    "no-class-assign": "error",
    "no-compare-neg-zero": "error",
    "no-cond-assign": "error",
    "no-const-assign": "error",
    "no-constant-binary-expression": "error",
    "no-constant-condition": "error",
    "no-control-regex": "error",
    "no-debugger": "error",
    "no-delete-var": "error",
    "no-dupe-args": "error",
    "no-dupe-class-members": "error",
    "no-dupe-else-if": "error",
    "no-dupe-keys": "error",
    "no-duplicate-case": "error",
    "no-empty": "error",
    "no-empty-character-class": "error",
    "no-empty-pattern": "error",
    "no-empty-static-block": "error",
    "no-ex-assign": "error",
    "no-extra-boolean-cast": "error",
    "no-fallthrough": "error",
    "no-func-assign": "error",
    "no-global-assign": "error",
    "no-import-assign": "error",
    "no-invalid-regexp": "error",
    "no-irregular-whitespace": "error",
    "no-loss-of-precision": "error",
    "no-misleading-character-class": "error",
    "no-new-native-nonconstructor": "error",
    "no-nonoctal-decimal-escape": "error",
    "no-obj-calls": "error",
    "no-octal": "error",
    "no-prototype-builtins": "error",
    "no-redeclare": "error",
    "no-regex-spaces": "error",
    "no-self-assign": "error",
    "no-setter-return": "error",
    "no-shadow-restricted-names": "error",
    "no-sparse-arrays": "error",
    "no-this-before-super": "error",
    "no-undef": "error",
    "no-unexpected-multiline": "error",
    "no-unreachable": "error",
    "no-unsafe-finally": "error",
    "no-unsafe-negation": "error",
    "no-unsafe-optional-chaining": "error",
    "no-unused-labels": "error",
    "no-unused-private-class-members": "error",
    "no-unused-vars": "error",
    "no-useless-backreference": "error",
    "no-useless-catch": "error",
    "no-useless-escape": "error",
    "no-with": "error",
    "require-yield": "error",
    "use-isnan": "error",
    "valid-typeof": "error",
  },
};

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
  recommended,
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
