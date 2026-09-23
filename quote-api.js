/* Mock API for the car insurance quote form, mounted at /api/quote. */
const express = require("express");
const crypto = require("crypto");
const logic = require("./quote-logic.js");
const data = require("./quote-data.js");

/** Jittered delay so loading states are real: 300 to 900 ms by default. */
function jitter(min = 300, max = 900) {
  return () => min + Math.floor(Math.random() * (max - min + 1));
}

function quoteReference() {
  // No 0/O or 1/I so the reference reads cleanly over the phone.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `QT-${out.slice(0, 4)}-${out.slice(4)}`;
}

/**
 * @param {{delayMs?: () => number, now?: () => Date}} [options]
 *   delayMs: artificial latency per request (tests pass () => 0)
 *   now: clock used for age and premium rules
 */
function createQuoteRouter(options = {}) {
  const delayMs = options.delayMs || jitter();
  const now = options.now || (() => new Date());
  const router = express.Router();

  router.use(express.json({ limit: "20kb" }));
  router.use((_req, _res, next) => {
    const ms = delayMs();
    if (ms > 0) setTimeout(next, ms);
    else next();
  });

  const badRequest = (res, error) => res.status(400).json({ error });

  router.get("/countries", (_req, res) => {
    res.json(data.COUNTRIES.map((c) => ({ code: c.code, name: c.name })));
  });

  router.get("/regions", (req, res) => {
    const c = data.getCountry(req.query.country);
    if (!c) return badRequest(res, "Unknown country.");
    res.json(c.regions.map((r) => ({ code: r.code, name: r.name })));
  });

  router.get("/cities", (req, res) => {
    if (!data.getCountry(req.query.country)) return badRequest(res, "Unknown country.");
    const r = data.getRegion(req.query.country, req.query.region);
    if (!r) return badRequest(res, "Unknown state or region.");
    res.json(r.cities.map(([code, name]) => ({ code, name })));
  });

  router.get("/postcode", (req, res) => {
    if (!data.getCountry(req.query.country)) return badRequest(res, "Unknown country.");
    res.json(data.checkPostcode(req.query.country, req.query.postcode));
  });

  router.get("/makes", (_req, res) => {
    res.json(data.MAKES.map((m) => ({ code: m.code, name: m.name })));
  });

  router.get("/models", (req, res) => {
    const m = data.getMake(req.query.make);
    if (!m) return badRequest(res, "Unknown make.");
    res.json(m.models.map(({ code, name, yearFrom, yearTo }) => ({ code, name, yearFrom, yearTo })));
  });

  // Validate everything, then price it. Shared by /premium and /submit.
  function priceOrErrors(body) {
    const today = now();
    const quote = logic.normalize(body);
    const ctx = data.serverContext(today);
    const errors = logic.validateAll(quote, ctx);
    if (Object.keys(errors).length) return { errors };
    quote.postcode = data.checkPostcode(quote.country, quote.postcode).postcode;
    const model = data.getModel(quote.make, quote.model);
    return { quote, premium: logic.calculatePremium(quote, model, today) };
  }

  router.post("/premium", (req, res) => {
    const out = priceOrErrors(req.body);
    if (out.errors) return res.status(400).json({ errors: out.errors });
    res.json(out.premium);
  });

  router.post("/submit", (req, res) => {
    const out = priceOrErrors(req.body);
    if (out.errors) return res.status(400).json({ errors: out.errors });
    res.status(201).json({ reference: quoteReference(), premium: out.premium });
  });

  router.use((_req, res) => res.status(404).json({ error: "Not found." }));

  // Malformed JSON bodies land here.
  // eslint-disable-next-line no-unused-vars
  router.use((err, _req, res, _next) => {
    const status = err.status && err.status < 500 ? err.status : 500;
    res.status(status).json({ error: status === 500 ? "Something went wrong." : "Invalid request body." });
  });

  return router;
}

module.exports = { createQuoteRouter, quoteReference };
