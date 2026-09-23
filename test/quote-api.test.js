const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../server.js");

const TODAY = new Date(2026, 8, 23);
let server;
let base;

before(async () => {
  const app = createApp({ quote: { delayMs: () => 0, now: () => TODAY } });
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

async function get(path) {
  const res = await fetch(base + path);
  const type = res.headers.get("content-type") || "";
  return { status: res.status, type, body: type.includes("json") ? await res.json() : await res.text() };
}

async function post(path, body, raw) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw !== undefined ? raw : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

const VALID = {
  fullName: "Tom Walker",
  dob: "1985-03-02",
  email: "tom@example.co.uk",
  phone: "07700 900123",
  country: "GB",
  region: "SCT",
  city: "glasgow",
  postcode: "g1 1xq",
  make: "volkswagen",
  model: "golf",
  year: "2019",
  usage: "business",
  companyName: "Walker Joinery",
  coverType: "tpft",
  addons: ["legal"],
  excess: "250",
};

describe("pages", () => {
  test("/ still serves the filter table", async () => {
    const r = await get("/");
    assert.equal(r.status, 200);
    assert.match(r.body, /<h1 class="page-title">Test Runs<\/h1>/);
  });

  test("/quote serves the quote form", async () => {
    const r = await get("/quote");
    assert.equal(r.status, 200);
    assert.match(r.body, /Get a car insurance quote/);
    assert.match(r.body, /<label for="postcode">Postcode<\/label>/);
  });

  test("/quote?step=3 serves the same page; the browser decides the step", async () => {
    const r = await get("/quote?step=3");
    assert.equal(r.status, 200);
    assert.match(r.body, /id="quote-form"/);
  });

  test("unknown paths still fall through to the filter table", async () => {
    const r = await get("/some/where");
    assert.equal(r.status, 200);
    assert.match(r.body, /Test Runs/);
  });
});

describe("option lists", () => {
  test("countries include India and the UK", async () => {
    const r = await get("/api/quote/countries");
    assert.equal(r.status, 200);
    const codes = r.body.map((c) => c.code);
    assert.ok(codes.includes("IN") && codes.includes("GB"));
    assert.deepEqual(Object.keys(r.body[0]).sort(), ["code", "name"]);
  });

  test("regions depend on country", async () => {
    const r = await get("/api/quote/regions?country=IN");
    assert.equal(r.status, 200);
    assert.ok(r.body.some((x) => x.name === "Maharashtra"));
    const bad = await get("/api/quote/regions?country=ZZ");
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error, "Unknown country.");
  });

  test("cities depend on country and region", async () => {
    const r = await get("/api/quote/cities?country=IN&region=MH");
    assert.deepEqual(r.body.map((c) => c.name), ["Pune", "Mumbai", "Nagpur"]);
    const wrongParent = await get("/api/quote/cities?country=GB&region=MH");
    assert.equal(wrongParent.status, 400);
  });

  test("models carry their year range", async () => {
    const r = await get("/api/quote/models?make=honda");
    assert.deepEqual(r.body.find((m) => m.code === "jazz"), { code: "jazz", name: "Jazz", yearFrom: 2010, yearTo: 2022 });
    assert.equal((await get("/api/quote/models?make=nope")).status, 400);
    assert.ok((await get("/api/quote/makes")).body.length >= 4);
  });

  test("unknown API paths return JSON 404, not the filter table", async () => {
    const r = await get("/api/quote/nope");
    assert.equal(r.status, 404);
    assert.deepEqual(r.body, { error: "Not found." });
  });
});

describe("postcode check", () => {
  test("a valid UK postcode comes back tidied", async () => {
    const r = await get("/api/quote/postcode?country=GB&postcode=sw1a1aa");
    assert.deepEqual(r.body, { valid: true, postcode: "SW1A 1AA" });
  });

  test("an Indian PIN in the UK is invalid, with a reason", async () => {
    const r = await get("/api/quote/postcode?country=GB&postcode=411001");
    assert.equal(r.status, 200);
    assert.equal(r.body.valid, false);
    assert.match(r.body.error, /United Kingdom postcode/);
  });

  test("each country has its own rule", async () => {
    assert.equal((await get("/api/quote/postcode?country=IN&postcode=411001")).body.valid, true);
    assert.equal((await get("/api/quote/postcode?country=IN&postcode=011001")).body.valid, false);
    assert.equal((await get("/api/quote/postcode?country=DE&postcode=10115")).body.valid, true);
    assert.equal((await get("/api/quote/postcode?country=AU&postcode=20000")).body.valid, false);
  });

  test("unknown country is a bad request", async () => {
    assert.equal((await get("/api/quote/postcode?country=ZZ&postcode=1")).status, 400);
  });
});

describe("premium", () => {
  test("a valid quote is priced in local currency", async () => {
    const r = await post("/api/quote/premium", VALID);
    assert.equal(r.status, 200);
    assert.equal(r.body.currency, "GBP");
    // 450 base x 1.3 business x 0.75 tpft x 0.9 (excess 250) = 394.875 -> 395, plus legal 23 (450 x 0.05 = 22.5)
    assert.equal(r.body.breakdown.cover, 395);
    assert.deepEqual(r.body.breakdown.addons, [{ code: "legal", label: "Legal cover", amount: 23 }]);
    assert.equal(r.body.annual, 418);
  });

  test("an incomplete quote returns field errors", async () => {
    const r = await post("/api/quote/premium", { ...VALID, coverType: "" });
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(r.body.errors), ["coverType"]);
  });
});

describe("submit", () => {
  test("a valid quote returns a reference and the price", async () => {
    const r = await post("/api/quote/submit", VALID);
    assert.equal(r.status, 201);
    assert.match(r.body.reference, /^QT-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    assert.equal(r.body.premium.annual, 418);
  });

  test("an empty submit returns an error for every required field", async () => {
    const r = await post("/api/quote/submit", {});
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(r.body.errors).sort(), [
      "country", "coverType", "dob", "email", "excess", "fullName", "make", "phone", "postcode", "usage",
    ]);
  });

  test("the server re-checks what the browser should have caught", async () => {
    const r = await post("/api/quote/submit", {
      ...VALID,
      dob: "2010-01-01",
      postcode: "411001",
      year: "2005",
      companyName: "",
      addons: ["courtesy_car"],
    });
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(r.body.errors).sort(), ["addons", "companyName", "dob", "postcode", "year"]);
    assert.match(r.body.errors.dob, /18 or older/);
  });

  test("malformed JSON is a 400 with a JSON body", async () => {
    const r = await post("/api/quote/submit", null, "{not json");
    assert.equal(r.status, 400);
    assert.equal(r.body.error, "Invalid request body.");
  });
});
