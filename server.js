const express = require("express");
const path = require("path");
const { createQuoteRouter } = require("./quote-api.js");

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
