const express = require("express");
const path = require("path");
const { createQuoteRouter } = require("./quote-api.js");
const { createLegacyRouter } = require("./legacy-vendor.js");
const { createGauntletRouter } = require("./gauntlet-api.js");

const PORT = process.env.PORT || 3000;

/** @param {{quote?: object}} [options] passed to the quote API (tests turn off its delay) */
function createApp(options = {}) {
  const app = express();

  // Security headers on every response. The pages load only same-origin
  // scripts and styles, except the Luxon build index.html pulls from cdnjs.
  app.use((_req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self'; " +
        "img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; " +
        "base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    );
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });

  app.use(express.static(path.join(__dirname)));

  // Car insurance quote form and its mock API. Registered before the catch-all.
  app.use("/api/quote", createQuoteRouter(options.quote));
  app.get("/quote", (_req, res) => {
    res.sendFile(path.join(__dirname, "quote.html"));
  });

  // Enterprise gauntlet: pages built to stress browser automation in
  // realistic ways. Every page works correctly for a human.
  app.use("/api", createGauntletRouter(options.gauntlet));
  app.use("/legacy", createLegacyRouter());
  const page = (route, file) =>
    app.get(route, (_req, res) => res.sendFile(path.join(__dirname, file)));
  page("/approvals", "approvals.html");
  page("/grid", "grid.html");
  page("/wizard", "wizard.html");
  page("/payment", "payment.html");
  // The card iframe document: the global CSP forbids all framing
  // (frame-ancestors 'none'), so this one response allows same-origin only.
  app.get("/payment/frame", (_req, res) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; " +
        "img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; " +
        "base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
    );
    res.sendFile(path.join(__dirname, "payment-frame.html"));
  });

  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
  });

  return app;
}

if (require.main === module) {
  createApp().listen(PORT, () => {
    console.log(`ShipGuard running on port ${PORT}`);
  });
}

module.exports = { createApp };
