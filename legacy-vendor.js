/* Vendor Master — an ASP.NET WebForms emulation, served from Express.

   Reproduces what makes legacy enterprise apps hard for browser automation,
   while staying fully correct for a human user:
   - every interaction is a full-page POST postback that re-renders the page
     and drops focus (country change repopulates the state list server-side);
   - hidden __VIEWSTATE / __EVENTTARGET fields drive the postback protocol,
     and a tampered viewstate fails the request like the real thing;
   - control ids are WebForms-mangled (ctl00_Main_txtVendorName) and two
     toolbar buttons carry the same "Save" label;
   - validation errors render as a ValidationSummary block at the top. */
const express = require("express");
const crypto = require("crypto");

const VIEWSTATE_SECRET = "shipguard-demo-viewstate";

const COUNTRIES = {
  IN: { name: "India", taxLabel: "GSTIN", taxHint: "15 characters, e.g. 27AAPFU0939F1ZV", taxRe: /^[0-9A-Z]{15}$/i, states: ["Gujarat", "Karnataka", "Maharashtra", "Tamil Nadu", "Telangana"] },
  US: { name: "United States", taxLabel: "EIN", taxHint: "9 digits, e.g. 12-3456789", taxRe: /^\d{2}-?\d{7}$/, states: ["California", "Illinois", "New York", "Texas", "Washington"] },
  DE: { name: "Germany", taxLabel: "USt-IdNr.", taxHint: "DE followed by 9 digits", taxRe: /^DE\d{9}$/i, states: ["Baden-Württemberg", "Bavaria", "Berlin", "Hamburg", "Hesse"] },
  GB: { name: "United Kingdom", taxLabel: "VAT number", taxHint: "GB followed by 9 digits", taxRe: /^GB\d{9}$/i, states: ["England", "Northern Ireland", "Scotland", "Wales"] },
};
const TERMS = ["Net 15", "Net 30", "Net 45", "Net 60", "Due on receipt"];

function sign(payload) {
  return crypto.createHmac("sha256", VIEWSTATE_SECRET).update(payload).digest("hex").slice(0, 24);
}
function encodeViewstate(state) {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64");
  return `${payload}.${sign(payload)}`;
}
function decodeViewstate(raw) {
  if (typeof raw !== "string" || !raw.includes(".")) return null;
  const [payload, mac] = raw.split(".");
  if (sign(payload) !== mac) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function vendorCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(5);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `VEN-${out}`;
}

function fieldsFrom(body) {
  return {
    name: (body["ctl00$Main$txtVendorName"] || "").trim(),
    taxId: (body["ctl00$Main$txtTaxId"] || "").trim(),
    country: body["ctl00$Main$ddlCountry"] || "",
    state: body["ctl00$Main$ddlState"] || "",
    terms: body["ctl00$Main$ddlTerms"] || "",
    autoCode: body["ctl00$Main$chkAutoCode"] === "on",
  };
}

function validate(f) {
  const errors = [];
  if (f.name.length < 3) errors.push("Vendor name is required (at least 3 characters).");
  const c = COUNTRIES[f.country];
  if (!c) errors.push("Country is required.");
  if (c && !c.taxRe.test(f.taxId)) errors.push(`${c.taxLabel} is not in a valid format (${c.taxHint}).`);
  if (c && !c.states.includes(f.state)) errors.push("State/Province is required.");
  if (!TERMS.includes(f.terms)) errors.push("Payment terms are required.");
  return errors;
}

function options(list, selected, placeholder) {
  const head = `<option value="">${esc(placeholder)}</option>`;
  return head + list
    .map(([value, label]) => `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(label)}</option>`)
    .join("");
}

function renderPage(f, errors) {
  const c = COUNTRIES[f.country];
  const viewstate = encodeViewstate(f);
  const countryOptions = options(Object.entries(COUNTRIES).map(([k, v]) => [k, v.name]), f.country, "-- Select country --");
  const stateOptions = c
    ? options(c.states.map((s) => [s, s]), f.state, "-- Select state --")
    : `<option value="">-- Select country first --</option>`;
  const termsOptions = options(TERMS.map((t) => [t, t]), f.terms, "-- Select terms --");
  const summary = errors.length
    ? `<div class="erp-validation" id="ctl00_Main_ValidationSummary1">
        <strong>The following errors must be corrected before the vendor can be saved:</strong>
        <ul>${errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
      </div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vendor Master — ACME ERP 6.2</title>
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/gauntlet.css" />
</head>
<body>
  <div class="app">
    <header class="header">
      <div class="header-inner">
        <div class="logo"><span class="logo-icon">⚓</span><span class="logo-text">ShipGuarde</span></div>
        <span class="header-tagline">ACME ERP 6.2 — Vendor Master (WebForms)</span>
      </div>
    </header>
    <nav class="site-nav" aria-label="Demo pages">
      <div class="site-nav-inner">
        <a href="/">Test Runs</a>
        <a href="/quote">Quote Form</a>
        <a href="/approvals">Approvals</a>
        <a href="/legacy" class="active">Vendor Master</a>
        <a href="/grid">Orders</a>
        <a href="/wizard">Travel Request</a>
        <a href="/payment">Checkout</a>
      </div>
    </nav>
    <div class="erp-shell">
      <form method="post" action="/legacy" id="aspnetForm">
        <input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="${esc(viewstate)}" />
        <input type="hidden" name="__EVENTTARGET" id="__EVENTTARGET" value="" />
        <input type="hidden" name="__EVENTARGUMENT" id="__EVENTARGUMENT" value="" />
        <div class="erp-titlebar">Vendor Master — New Vendor</div>
        <div class="erp-box">
          <div class="erp-toolbar">
            <button type="submit" class="erp-btn" name="ctl00$Main$btnSaveTop" value="Save" id="ctl00_Main_btnSaveTop">Save</button>
            <button type="button" class="erp-btn" id="ctl00_Main_btnNew">New</button>
            <button type="button" class="erp-btn" id="ctl00_Main_btnDelete" disabled>Delete</button>
            <button type="button" class="erp-btn" id="ctl00_Main_btnRefresh">Refresh</button>
          </div>
          ${summary}
          <div class="erp-grid">
            <label for="ctl00_Main_txtVendorName">Vendor name <span class="erp-req">*</span></label>
            <input type="text" name="ctl00$Main$txtVendorName" id="ctl00_Main_txtVendorName" value="${esc(f.name)}" maxlength="80" />

            <label for="ctl00_Main_ddlCountry">Country <span class="erp-req">*</span></label>
            <select name="ctl00$Main$ddlCountry" id="ctl00_Main_ddlCountry">${countryOptions}</select>

            <label for="ctl00_Main_ddlState">State/Province <span class="erp-req">*</span></label>
            <select name="ctl00$Main$ddlState" id="ctl00_Main_ddlState"${c ? "" : " disabled"}>${stateOptions}</select>

            <label for="ctl00_Main_txtTaxId">${esc(c ? c.taxLabel : "Tax ID")} <span class="erp-req">*</span></label>
            <input type="text" name="ctl00$Main$txtTaxId" id="ctl00_Main_txtTaxId" value="${esc(f.taxId)}" maxlength="20" />

            <label for="ctl00_Main_ddlTerms">Payment terms <span class="erp-req">*</span></label>
            <select name="ctl00$Main$ddlTerms" id="ctl00_Main_ddlTerms">${termsOptions}</select>

            <label for="ctl00_Main_chkAutoCode">Auto vendor code</label>
            <span class="g-check"><input type="checkbox" name="ctl00$Main$chkAutoCode" id="ctl00_Main_chkAutoCode"${f.autoCode ? " checked" : ""} /> Generate the vendor code automatically on save</span>
          </div>
          <div class="erp-toolbar">
            <button type="submit" class="erp-btn" name="ctl00$Main$btnSave" value="Save" id="ctl00_Main_btnSave">Save</button>
            <button type="button" class="erp-btn" id="ctl00_Main_btnCancel">Cancel</button>
          </div>
          <p class="erp-note">${esc(c ? `${c.taxLabel}: ${c.taxHint}.` : "Select a country to load the state list. The page reloads — this is a WebForms postback.")}</p>
        </div>
      </form>
    </div>
  </div>
  <script src="/legacy.js"></script>
</body>
</html>`;
}

function renderDone(code, name) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vendor saved — ACME ERP 6.2</title>
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/gauntlet.css" />
</head>
<body>
  <div class="app">
    <header class="header">
      <div class="header-inner">
        <div class="logo"><span class="logo-icon">⚓</span><span class="logo-text">ShipGuarde</span></div>
        <span class="header-tagline">ACME ERP 6.2 — Vendor Master (WebForms)</span>
      </div>
    </header>
    <div class="erp-shell">
      <div class="erp-titlebar">Vendor Master — Saved</div>
      <div class="erp-box">
        <div class="erp-success" id="ctl00_Main_pnlSuccess">
          Vendor <strong>${esc(name)}</strong> was saved successfully.<br />
          Vendor code: <span class="code" id="ctl00_Main_lblVendorCode">${esc(code)}</span>
        </div>
        <p class="erp-note"><a href="/legacy">Create another vendor</a> · <a href="/">Back to Test Runs</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function createLegacyRouter() {
  const router = express.Router();
  router.use(express.urlencoded({ extended: false }));

  const empty = { name: "", taxId: "", country: "", state: "", terms: "", autoCode: true };

  router.get("/", (_req, res) => {
    res.send(renderPage(empty, []));
  });

  router.get("/done", (req, res) => {
    const code = /^VEN-[A-Z2-9]{5}$/.test(req.query.code || "") ? req.query.code : "VEN-UNKNWN";
    res.send(renderDone(code, String(req.query.name || "vendor").slice(0, 80)));
  });

  router.post("/", (req, res) => {
    if (decodeViewstate(req.body.__VIEWSTATE) === null) {
      res.status(400).send("Invalid postback or callback argument. The __VIEWSTATE could not be validated.");
      return;
    }
    const f = fieldsFrom(req.body);
    const target = req.body.__EVENTTARGET || "";
    const isSave = "ctl00$Main$btnSave" in req.body || "ctl00$Main$btnSaveTop" in req.body;

    if (target === "ctl00$Main$ddlCountry" || !isSave) {
      // A change postback (or Refresh): the country's state list is loaded
      // server-side; a state from another country is dropped.
      const c = COUNTRIES[f.country];
      if (!c || !c.states.includes(f.state)) f.state = "";
      res.send(renderPage(f, []));
      return;
    }

    const errors = validate(f);
    if (errors.length) {
      res.send(renderPage(f, errors));
      return;
    }
    const code = vendorCode();
    res.redirect(303, `/legacy/done?code=${encodeURIComponent(code)}&name=${encodeURIComponent(f.name)}`);
  });

  return router;
}

module.exports = { createLegacyRouter, COUNTRIES, TERMS, validate, encodeViewstate, decodeViewstate };
