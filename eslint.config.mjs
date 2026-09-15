import js from "@eslint/js";

const browserGlobals = {
  window: "readonly", document: "readonly", globalThis: "readonly",
  setTimeout: "readonly", clearTimeout: "readonly", requestAnimationFrame: "readonly",
  ShipGuardFilters: "readonly",
  luxon: "readonly",
};
const nodeGlobals = {
  require: "readonly", module: "writable", process: "readonly", __dirname: "readonly", console: "readonly",
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
    files: ["server.js", "test/**/*.js"],
    languageOptions: { sourceType: "commonjs", globals: nodeGlobals },
  },
];
