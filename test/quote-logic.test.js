const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const L = require("../quote-logic.js");
const { serverContext } = require("../quote-data.js");

const TODAY = new Date(2026, 8, 23); // 23 Sep 2026, local time
const ctx = serverContext(TODAY);

const VALID = Object.freeze({
  fullName: "Asha Patel",
  dob: "1990-05-14",
  email: "asha@example.com",
  phone: "+91 98765 43210",
  country: "IN",
  region: "MH",
  city: "pune",
  postcode: "411001",
  make: "toyota",
  model: "corolla",
  year: "2020",
  usage: "personal",
  companyName: "",
  coverType: "comprehensive",
  addons: ["breakdown"],
  excess: "0",
});
const quote = (over = {}) => L.normalize({ ...VALID, ...over });

describe("step 1: about you", () => {
  test("a complete step has no errors", () => {
    assert.deepEqual(L.validateStep(1, quote(), ctx), {});
  });

  test("every field is required", () => {
    const e = L.validateStep(1, quote({ fullName: "", dob: "", email: "", phone: "" }), ctx);
    assert.deepEqual(Object.keys(e).sort(), ["dob", "email", "fullName", "phone"]);
  });

  test("the driver must be 18 or older, counted to the day", () => {
    assert.equal(L.validateStep(1, quote({ dob: "2008-09-23" }), ctx).dob, undefined, "18 today is allowed");
    assert.match(L.validateStep(1, quote({ dob: "2008-09-24" }), ctx).dob, /18 or older/);
  });

  test("impossible and future dates are rejected", () => {
    assert.match(L.validateStep(1, quote({ dob: "1990-02-30" }), ctx).dob, /real date/);
    assert.match(L.validateStep(1, quote({ dob: "2027-01-01" }), ctx).dob, /future/);
    assert.match(L.validateStep(1, quote({ dob: "14/05/1990" }), ctx).dob, /real date/);
  });

  test("email and phone formats", () => {
    assert.ok(L.validateStep(1, quote({ email: "asha@example" }), ctx).email);
    assert.ok(L.validateStep(1, quote({ phone: "12345" }), ctx).phone, "too few digits");
    assert.ok(L.validateStep(1, quote({ phone: "call me" }), ctx).phone);
    assert.equal(L.validateStep(1, quote({ phone: "(020) 7946-0958" }), ctx).phone, undefined);
  });
});

describe("step 2: address", () => {
  test("a complete step has no errors", () => {
    assert.deepEqual(L.validateStep(2, quote(), ctx), {});
  });

  test("region and city must belong to their parent", () => {
    assert.ok(L.validateStep(2, quote({ region: "ENG" }), ctx).region, "England is not an Indian state");
    assert.ok(L.validateStep(2, quote({ city: "chennai" }), ctx).city, "Chennai is not in Maharashtra");
  });

  test("postcode format is checked against the country", () => {
    assert.match(L.validateStep(2, quote({ postcode: "SW1A 1AA" }), ctx).postcode, /India postcode/);
    const uk = quote({ country: "GB", region: "ENG", city: "london", postcode: "sw1a1aa" });
    assert.equal(L.validateStep(2, uk, ctx).postcode, undefined);
  });

  test("an unchecked postcode blocks the step", () => {
    const pending = { ...ctx, checkPostcode: () => null };
    assert.ok(L.validateStep(2, quote(), pending).postcode);
  });
});

describe("step 3: vehicle", () => {
  test("a complete step has no errors", () => {
    assert.deepEqual(L.validateStep(3, quote(), ctx), {});
  });

  test("year must sit inside the chosen model's range", () => {
    assert.match(L.validateStep(3, quote({ year: "2011" }), ctx).year, /between 2012 and 2026/);
    assert.match(L.validateStep(3, quote({ make: "honda", model: "jazz", year: "2024" }), ctx).year, /between 2010 and 2022/);
  });

  test("model must belong to the make", () => {
    assert.ok(L.validateStep(3, quote({ model: "civic" }), ctx).model);
  });

  test("business use requires a company name", () => {
    assert.match(L.validateStep(3, quote({ usage: "business" }), ctx).companyName, /company name/i);
    assert.deepEqual(L.validateStep(3, quote({ usage: "business", companyName: "Acme Ltd" }), ctx), {});
  });

  test("a company name sent with non-business use is dropped, not kept", () => {
    assert.equal(quote({ usage: "personal", companyName: "Acme Ltd" }).companyName, "");
  });
});

describe("step 4: cover", () => {
  test("a complete step has no errors", () => {
    assert.deepEqual(L.validateStep(4, quote(), ctx), {});
  });

  test("breakdown and courtesy car are comprehensive only", () => {
    assert.deepEqual(L.allowedAddons("third_party"), ["legal", "personal_accident"]);
    assert.deepEqual(L.allowedAddons("comprehensive"), ["legal", "personal_accident", "breakdown", "courtesy_car"]);
    assert.ok(L.validateStep(4, quote({ coverType: "third_party", addons: ["breakdown"] }), ctx).addons);
  });

  test("excess must be one of the country's options", () => {
    assert.equal(L.validateStep(4, quote({ excess: "5000" }), ctx).excess, undefined);
    assert.ok(L.validateStep(4, quote({ excess: "500" }), ctx).excess, "500 is a GBP option, not INR");
  });
});

describe("dependency resets", () => {
  test("changing country clears region, city, postcode and excess", () => {
    const next = L.applyChange(quote({ excess: "5000" }), "country", "GB");
    assert.equal(next.country, "GB");
    assert.deepEqual([next.region, next.city, next.postcode, next.excess], ["", "", "", "0"]);
    assert.equal(next.make, "toyota", "unrelated fields stay");
  });

  test("changing region clears only city", () => {
    const next = L.applyChange(quote(), "region", "KA");
    assert.deepEqual([next.country, next.region, next.city, next.postcode], ["IN", "KA", "", "411001"]);
  });

  test("changing make clears model and year; changing model clears year", () => {
    const a = L.applyChange(quote(), "make", "honda");
    assert.deepEqual([a.model, a.year], ["", ""]);
    const b = L.applyChange(quote(), "model", "yaris");
    assert.deepEqual([b.make, b.model, b.year], ["toyota", "yaris", ""]);
  });

  test("setting the same value keeps dependents", () => {
    const next = L.applyChange(quote(), "country", "IN");
    assert.equal(next.region, "MH");
    assert.equal(next.city, "pune");
  });

  test("leaving business use drops the company name", () => {
    const biz = L.applyChange(quote(), "usage", "business");
    const named = L.applyChange(biz, "companyName", "Acme Ltd");
    assert.equal(named.companyName, "Acme Ltd");
    assert.equal(L.applyChange(named, "usage", "commuting").companyName, "");
  });

  test("downgrading cover drops add-ons it does not allow", () => {
    const start = quote({ addons: ["legal", "breakdown", "courtesy_car"] });
    assert.deepEqual(L.applyChange(start, "coverType", "tpft").addons, ["legal"]);
  });

  test("the input object is not modified", () => {
    const start = quote();
    L.applyChange(start, "country", "GB");
    assert.equal(start.region, "MH");
  });
});

describe("step routing", () => {
  test("a fully valid quote can reach review", () => {
    assert.equal(L.firstInvalidStep(quote(), ctx), L.REVIEW_STEP);
    assert.equal(L.resolveStep("5", quote(), ctx), 5);
    assert.equal(L.resolveStep("3", quote(), ctx), 3);
  });

  test("a later step redirects to the first invalid one", () => {
    assert.equal(L.resolveStep("4", quote({ city: "" }), ctx), 2);
    assert.equal(L.resolveStep("4", L.emptyQuote(), ctx), 1);
  });

  test("junk step values fall back to step 1", () => {
    for (const bad of ["0", "9", "abc", null, "2.5"]) assert.equal(L.resolveStep(bad, quote(), ctx), 1);
  });

  test("stepOfField maps fields to their page", () => {
    assert.equal(L.stepOfField("postcode"), 2);
    assert.equal(L.stepOfField("companyName"), 3);
    assert.equal(L.stepOfField("excess"), 4);
  });
});

describe("premium", () => {
  const corolla = { group: 2 };

  test("a 36 year old, 6 year old Corolla, comprehensive with breakdown in India", () => {
    const p = L.calculatePremium(quote(), corolla, TODAY);
    // 9000 base, every factor 1.0 for this profile, plus breakdown at 10% of base.
    assert.deepEqual(p, {
      currency: "INR",
      annual: 9900,
      monthly: 866.25,
      breakdown: { cover: 9000, addons: [{ code: "breakdown", label: "Breakdown cover", amount: 900 }] },
    });
  });

  test("cover type, usage and excess each move the price the right way", () => {
    const base = L.calculatePremium(quote({ addons: [] }), corolla, TODAY).annual;
    assert.ok(L.calculatePremium(quote({ addons: [], coverType: "third_party" }), corolla, TODAY).annual < base);
    assert.ok(L.calculatePremium(quote({ addons: [], usage: "business", companyName: "Acme" }), corolla, TODAY).annual > base);
    assert.ok(L.calculatePremium(quote({ addons: [], excess: "10000" }), corolla, TODAY).annual < base);
  });

  test("young drivers and high rating groups pay more", () => {
    const base = L.calculatePremium(quote({ addons: [] }), corolla, TODAY).annual;
    assert.equal(L.calculatePremium(quote({ addons: [], dob: "2005-01-01" }), corolla, TODAY).annual, Math.round(base * 1.6));
    assert.equal(L.calculatePremium(quote({ addons: [] }), { group: 4 }, TODAY).annual, Math.round(base * 1.6));
  });

  test("currency follows the country", () => {
    const uk = quote({ country: "GB", region: "ENG", city: "london", postcode: "SW1A 1AA", addons: [] });
    const p = L.calculatePremium(uk, corolla, TODAY);
    assert.equal(p.currency, "GBP");
    assert.equal(p.annual, 450);
  });
});
