const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../server.js");
const { encodeViewstate } = require("../legacy-vendor.js");

let server;
let base;

before(async () => {
  const app = createApp({ quote: { delayMs: () => 0 }, gauntlet: { delayMs: () => 0 } });
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

async function get(path) {
  const res = await fetch(base + path, { redirect: "manual" });
  return { status: res.status, headers: res.headers, body: await res.text() };
}

async function postForm(path, fields) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
    redirect: "manual",
  });
  return { status: res.status, headers: res.headers, body: await res.text() };
}

async function postJson(path, body) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

describe("gauntlet pages", () => {
  for (const path of ["/approvals", "/grid", "/wizard", "/payment", "/legacy"]) {
    test(`${path} serves a page`, async () => {
      const res = await get(path);
      assert.equal(res.status, 200);
      assert.match(res.body, /<!DOCTYPE html>/);
    });
  }

  test("the card frame allows same-origin framing while other pages forbid all", async () => {
    const frame = await get("/payment/frame");
    assert.match(frame.headers.get("content-security-policy"), /frame-ancestors 'self'/);
    const page = await get("/payment");
    assert.match(page.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  });
});

describe("legacy vendor master (WebForms emulation)", () => {
  const viewstate = () =>
    encodeViewstate({ name: "", taxId: "", country: "", state: "", terms: "", autoCode: true });

  test("GET renders the form with viewstate and both Save buttons", async () => {
    const res = await get("/legacy");
    assert.equal(res.status, 200);
    assert.match(res.body, /__VIEWSTATE/);
    assert.match(res.body, /ctl00_Main_btnSaveTop/);
    assert.match(res.body, /ctl00_Main_btnSave/);
    assert.match(res.body, /-- Select country first --/);
  });

  test("a tampered viewstate is rejected like real WebForms", async () => {
    const res = await postForm("/legacy", { __VIEWSTATE: "not.valid" });
    assert.equal(res.status, 400);
    assert.match(res.body, /Invalid postback/);
  });

  test("country change postback loads that country's states and keeps typed values", async () => {
    const res = await postForm("/legacy", {
      __VIEWSTATE: viewstate(),
      __EVENTTARGET: "ctl00$Main$ddlCountry",
      "ctl00$Main$txtVendorName": "Contoso Espresso",
      "ctl00$Main$ddlCountry": "IN",
      "ctl00$Main$ddlState": "",
      "ctl00$Main$ddlTerms": "",
    });
    assert.equal(res.status, 200);
    assert.match(res.body, /Maharashtra/);
    assert.match(res.body, /value="Contoso Espresso"/);
    assert.match(res.body, /GSTIN/);
  });

  test("save with invalid fields renders a validation summary", async () => {
    const res = await postForm("/legacy", {
      __VIEWSTATE: viewstate(),
      "ctl00$Main$btnSave": "Save",
      "ctl00$Main$txtVendorName": "Co",
      "ctl00$Main$ddlCountry": "IN",
      "ctl00$Main$txtTaxId": "nope",
      "ctl00$Main$ddlState": "",
      "ctl00$Main$ddlTerms": "",
    });
    assert.equal(res.status, 200);
    assert.match(res.body, /errors must be corrected/);
    assert.match(res.body, /Vendor name is required/);
    assert.match(res.body, /GSTIN is not in a valid format/);
    assert.match(res.body, /State\/Province is required/);
    assert.match(res.body, /Payment terms are required/);
  });

  test("a valid save redirects to the confirmation with a vendor code", async () => {
    const res = await postForm("/legacy", {
      __VIEWSTATE: viewstate(),
      "ctl00$Main$btnSaveTop": "Save",
      "ctl00$Main$txtVendorName": "Contoso Espresso",
      "ctl00$Main$ddlCountry": "IN",
      "ctl00$Main$txtTaxId": "27AAPFU0939F1ZV",
      "ctl00$Main$ddlState": "Maharashtra",
      "ctl00$Main$ddlTerms": "Net 30",
    });
    assert.equal(res.status, 303);
    const location = res.headers.get("location");
    assert.match(location, /^\/legacy\/done\?code=VEN-[A-Z2-9]{5}/);
    const done = await get(location);
    assert.match(done.body, /saved successfully/);
    assert.match(done.body, /VEN-/);
  });
});

describe("wizard API", () => {
  test("verifies a known employee", async () => {
    const res = await get("/api/wizard/employee?id=E-10423");
    assert.match(res.body, /Priya Nair/);
  });

  test("rejects an unknown or malformed employee id", async () => {
    const bad = await get("/api/wizard/employee?id=E-99999");
    assert.match(bad.body, /No employee/);
    const malformed = await get("/api/wizard/employee?id=banana");
    assert.match(malformed.body, /look like E-10423/);
  });

  test("submit returns a TR reference for a valid request", async () => {
    const res = await postJson("/api/wizard/submit", {
      employeeId: "E-10423",
      from: "Pune",
      to: "Singapore",
      depart: "2026-10-05",
      ret: "2026-10-09",
      costCenter: "CC-4210",
    });
    assert.equal(res.status, 200);
    assert.match(res.body.reference, /^TR-[A-Z2-9]{6}$/);
  });

  test("submit rejects a return before departure", async () => {
    const res = await postJson("/api/wizard/submit", {
      employeeId: "E-10423",
      from: "Pune",
      to: "Singapore",
      depart: "2026-10-09",
      ret: "2026-10-05",
      costCenter: "CC-4210",
    });
    assert.equal(res.status, 422);
    assert.match(res.body.error, /dates/);
  });
});

describe("checkout API", () => {
  test("charges a complete request and returns a receipt", async () => {
    const res = await postJson("/api/payment/checkout", {
      name: "Priya Nair",
      email: "priya@example.com",
      city: "Pune",
      country: "India",
      last4: "4242",
      amount: 24999,
    });
    assert.equal(res.status, 200);
    assert.match(res.body.receipt, /^RCP-[A-Z2-9]{6}$/);
  });

  test("rejects an incomplete charge", async () => {
    const res = await postJson("/api/payment/checkout", { name: "x" });
    assert.equal(res.status, 422);
  });
});
