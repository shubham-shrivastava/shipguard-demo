/* ───────────────────────────────────────────────
   Car insurance quote: shared rules. Pure functions, no DOM, no I/O.
   Loaded by quote.html via <script> and by the server and tests via require().
   Catalog lookups (regions, models, postcode checks) are passed in through
   `ctx`, so the browser can answer them from what it has loaded and the
   server can answer them from its own data.
   ─────────────────────────────────────────────── */
(function (root) {
  const STEPS = [
    { id: 1, key: "about", title: "About you", fields: ["fullName", "dob", "email", "phone"] },
    { id: 2, key: "address", title: "Address", fields: ["country", "region", "city", "postcode"] },
    { id: 3, key: "vehicle", title: "Vehicle", fields: ["make", "model", "year", "usage", "companyName"] },
    { id: 4, key: "cover", title: "Cover", fields: ["coverType", "addons", "excess"] },
  ];
  const REVIEW_STEP = 5;

  const USAGES = [
    { code: "personal", label: "Personal" },
    { code: "commuting", label: "Commuting" },
    { code: "business", label: "Business" },
  ];

  const COVER_TYPES = [
    { code: "third_party", label: "Third party" },
    { code: "tpft", label: "Third party, fire and theft" },
    { code: "comprehensive", label: "Comprehensive" },
  ];

  const ADDONS = [
    { code: "legal", label: "Legal cover", covers: ["third_party", "tpft", "comprehensive"], rate: 0.05 },
    { code: "personal_accident", label: "Personal accident cover", covers: ["third_party", "tpft", "comprehensive"], rate: 0.04 },
    { code: "breakdown", label: "Breakdown cover", covers: ["comprehensive"], rate: 0.1 },
    { code: "courtesy_car", label: "Courtesy car", covers: ["comprehensive"], rate: 0.07 },
  ];

  // Per-country money settings. Excess options are amounts in local currency.
  const COUNTRY_MONEY = {
    IN: { currency: "INR", base: 9000, excess: [0, 2500, 5000, 10000] },
    GB: { currency: "GBP", base: 450, excess: [0, 100, 250, 500] },
    DE: { currency: "EUR", base: 520, excess: [0, 150, 300, 500] },
    AU: { currency: "AUD", base: 700, excess: [0, 200, 400, 800] },
  };
  const EXCESS_DISCOUNT = [0, 0.05, 0.1, 0.15];

  const EMPTY = Object.freeze({
    fullName: "", dob: "", email: "", phone: "",
    country: "", region: "", city: "", postcode: "",
    make: "", model: "", year: "", usage: "", companyName: "",
    coverType: "", addons: [], excess: "0",
  });

  function emptyQuote() {
    return { ...EMPTY, addons: [] };
  }

  /** Coerce untrusted input (a JSON body, restored storage) into the quote shape. */
  function normalize(input) {
    const src = input && typeof input === "object" ? input : {};
    const out = emptyQuote();
    for (const key of Object.keys(EMPTY)) {
      if (key === "addons") continue;
      const v = src[key];
      out[key] = v === undefined || v === null ? EMPTY[key] : String(v).trim();
    }
    out.addons = Array.isArray(src.addons)
      ? [...new Set(src.addons.map((a) => String(a)))]
      : [];
    if (out.excess === "") out.excess = "0";
    // Company name only exists for business use; anything else drops it.
    if (out.usage !== "business") out.companyName = "";
    return out;
  }

  // ── Dependencies ──
  // Which fields are cleared when a field changes. Order matters for chains.
  const DEPENDENTS = {
    country: ["region", "city", "postcode", "excess"],
    region: ["city"],
    make: ["model", "year"],
    model: ["year"],
  };

  function allowedAddons(coverType) {
    return ADDONS.filter((a) => a.covers.includes(coverType)).map((a) => a.code);
  }

  /**
   * Set `field` to `value` and clear whatever depended on the old value.
   * Returns a new object; the input is not modified. A no-op change keeps
   * dependents as they are.
   */
  function applyChange(data, field, value) {
    const next = { ...data, addons: [...(data.addons || [])] };
    const same = field === "addons"
      ? JSON.stringify(next.addons) === JSON.stringify(value)
      : next[field] === value;
    next[field] = field === "addons" ? [...value] : value;
    if (same) return next;

    for (const dep of DEPENDENTS[field] || []) {
      next[dep] = EMPTY[dep];
    }
    if (field === "usage" && value !== "business") {
      next.companyName = "";
    }
    if (field === "coverType") {
      const allowed = allowedAddons(value);
      next.addons = next.addons.filter((a) => allowed.includes(a));
    }
    return next;
  }

  // ── Field rules ──
  function parseIsoDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const date = new Date(Date.UTC(y, mo - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
    return { y, m: mo, d };
  }

  function ageOn(dob, today) {
    const t = { y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() };
    let age = t.y - dob.y;
    if (t.m < dob.m || (t.m === dob.m && t.d < dob.d)) age -= 1;
    return age;
  }

  function isAfter(dob, today) {
    const a = dob.y * 10000 + dob.m * 100 + dob.d;
    const b = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    return a > b;
  }

  function ruleFullName(v) {
    if (!v) return "Enter your full name.";
    if (v.length < 2 || !/\p{L}/u.test(v)) return "Enter your full name as it appears on your licence.";
    if (v.length > 100) return "Full name must be 100 characters or fewer.";
    return "";
  }

  function ruleDob(v, today) {
    if (!v) return "Enter your date of birth.";
    const dob = parseIsoDate(v);
    if (!dob) return "Enter a real date of birth.";
    if (isAfter(dob, today)) return "Date of birth cannot be in the future.";
    const age = ageOn(dob, today);
    if (age < 18) return "You must be 18 or older to get a quote.";
    if (age > 110) return "Enter a real date of birth.";
    return "";
  }

  function ruleEmail(v) {
    if (!v) return "Enter your email address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "Enter an email address like name@example.com.";
    return "";
  }

  function rulePhone(v) {
    if (!v) return "Enter your phone number.";
    if (!/^\+?[\d\s()-]+$/.test(v)) return "Phone number can only contain digits, spaces, brackets, dashes and a leading +.";
    const digits = v.replace(/\D/g, "").length;
    if (digits < 7 || digits > 15) return "Phone number must have between 7 and 15 digits.";
    return "";
  }

  // ── Step validation ──
  /**
   * @param {number} step 1 to 4
   * @param {object} data a normalized quote
   * @param {{
   *   today: Date,
   *   hasCountry(country): boolean,
   *   hasRegion(country, region): boolean,
   *   hasCity(country, region, city): boolean,
   *   checkPostcode(country, postcode): string | null,  // "" ok, message if bad, null if not checked yet
   *   hasMake(make): boolean,
   *   getModel(make, model): {yearFrom: number, yearTo: number} | null,
   * }} ctx
   * @returns {Record<string, string>} field -> message; empty when the step is valid
   */
  function validateStep(step, data, ctx) {
    const e = {};
    const set = (field, msg) => { if (msg) e[field] = msg; };

    if (step === 1) {
      set("fullName", ruleFullName(data.fullName));
      set("dob", ruleDob(data.dob, ctx.today));
      set("email", ruleEmail(data.email));
      set("phone", rulePhone(data.phone));
    }

    if (step === 2) {
      if (!data.country) set("country", "Choose a country.");
      else if (!ctx.hasCountry(data.country)) set("country", "Choose a country from the list.");

      if (!e.country) {
        if (!data.region) set("region", "Choose a state or region.");
        else if (!ctx.hasRegion(data.country, data.region)) set("region", "Choose a state or region from the list.");
      }
      if (!e.country && !e.region) {
        if (!data.city) set("city", "Choose a city.");
        else if (!ctx.hasCity(data.country, data.region, data.city)) set("city", "Choose a city from the list.");
      }
      if (!data.postcode) set("postcode", "Enter your postcode.");
      else if (!e.country) {
        const res = ctx.checkPostcode(data.country, data.postcode);
        if (res === null) set("postcode", "Postcode has not been checked yet.");
        else set("postcode", res);
      }
    }

    if (step === 3) {
      if (!data.make) set("make", "Choose a make.");
      else if (!ctx.hasMake(data.make)) set("make", "Choose a make from the list.");

      let model = null;
      if (!e.make) {
        if (!data.model) set("model", "Choose a model.");
        else {
          model = ctx.getModel(data.make, data.model);
          if (!model) set("model", "Choose a model from the list.");
        }
      }
      if (model) {
        const y = Number(data.year);
        if (!data.year) set("year", "Choose a year.");
        else if (!Number.isInteger(y) || y < model.yearFrom || y > model.yearTo) {
          set("year", `Choose a year between ${model.yearFrom} and ${model.yearTo}.`);
        }
      }
      if (!data.usage) set("usage", "Choose how the car will be used.");
      else if (!USAGES.some((u) => u.code === data.usage)) set("usage", "Choose how the car will be used.");

      if (data.usage === "business") {
        if (!data.companyName) set("companyName", "Enter the company name.");
        else if (data.companyName.length < 2) set("companyName", "Company name must be at least 2 characters.");
        else if (data.companyName.length > 100) set("companyName", "Company name must be 100 characters or fewer.");
      }
    }

    if (step === 4) {
      if (!data.coverType) set("coverType", "Choose a cover type.");
      else if (!COVER_TYPES.some((c) => c.code === data.coverType)) set("coverType", "Choose a cover type.");

      if (data.coverType && !e.coverType) {
        const allowed = allowedAddons(data.coverType);
        const bad = data.addons.filter((a) => !allowed.includes(a));
        if (bad.length) set("addons", "Some add-ons are not available with this cover type.");
      }

      const money = COUNTRY_MONEY[data.country];
      if (!money) set("excess", "Choose your address country first.");
      else if (!money.excess.map(String).includes(String(data.excess))) set("excess", "Choose a voluntary excess.");
    }

    return e;
  }

  function validateAll(data, ctx) {
    const errors = {};
    for (const s of STEPS) Object.assign(errors, validateStep(s.id, data, ctx));
    return errors;
  }

  /** First step with an error, or REVIEW_STEP when steps 1 to 4 are all valid. */
  function firstInvalidStep(data, ctx) {
    for (const s of STEPS) {
      if (Object.keys(validateStep(s.id, data, ctx)).length) return s.id;
    }
    return REVIEW_STEP;
  }

  function stepOfField(field) {
    const s = STEPS.find((st) => st.fields.includes(field));
    return s ? s.id : 1;
  }

  /** Where `/quote?step=N` should land: N if every earlier step is valid, else the first invalid one. */
  function resolveStep(requested, data, ctx) {
    const n = Number(requested);
    const want = Number.isInteger(n) && n >= 1 && n <= REVIEW_STEP ? n : 1;
    return Math.min(want, firstInvalidStep(data, ctx));
  }

  // ── Premium ──
  function groupFactor(group) {
    return { 1: 0.85, 2: 1, 3: 1.25, 4: 1.6 }[group] || 1;
  }
  function driverAgeFactor(age) {
    if (age < 25) return 1.6;
    if (age < 30) return 1.25;
    if (age < 70) return 1;
    return 1.2;
  }
  function vehicleAgeFactor(carAge) {
    if (carAge <= 2) return 1.1;
    if (carAge > 10) return 0.9;
    return 1;
  }
  const USAGE_FACTOR = { personal: 1, commuting: 1.1, business: 1.3 };
  const COVER_FACTOR = { third_party: 0.6, tpft: 0.75, comprehensive: 1 };

  /**
   * Annual premium in whole units of the country's currency.
   * Assumes `data` is valid (call validateAll first).
   * @param {object} data normalized quote
   * @param {{group: number}} model the chosen model's rating group, 1 (cheap) to 4
   * @param {Date} today
   */
  function calculatePremium(data, model, today) {
    const money = COUNTRY_MONEY[data.country];
    const age = ageOn(parseIsoDate(data.dob), today);
    const carAge = today.getFullYear() - Number(data.year);
    const excessIndex = Math.max(0, money.excess.map(String).indexOf(String(data.excess)));

    const core = money.base
      * groupFactor(model.group)
      * driverAgeFactor(age)
      * vehicleAgeFactor(carAge)
      * USAGE_FACTOR[data.usage]
      * COVER_FACTOR[data.coverType]
      * (1 - EXCESS_DISCOUNT[excessIndex]);
    const cover = Math.round(core);

    const addons = ADDONS
      .filter((a) => data.addons.includes(a.code))
      .map((a) => ({ code: a.code, label: a.label, amount: Math.round(money.base * a.rate) }));
    const annual = cover + addons.reduce((sum, a) => sum + a.amount, 0);
    const monthly = Math.round((annual * 1.05) / 12 * 100) / 100;

    return { currency: money.currency, annual, monthly, breakdown: { cover, addons } };
  }

  const api = {
    STEPS, REVIEW_STEP, USAGES, COVER_TYPES, ADDONS, COUNTRY_MONEY,
    emptyQuote, normalize, applyChange, allowedAddons,
    validateStep, validateAll, firstInvalidStep, stepOfField, resolveStep,
    ageOn, parseIsoDate, calculatePremium,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.QuoteLogic = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
