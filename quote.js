/* ───────────────────────────────────────────────
   Car insurance quote form. Vanilla JS, no framework.
   Rules live in quote-logic.js (QuoteLogic); this file owns the DOM,
   the async option lists, the postcode check and the premium fetch.
   ─────────────────────────────────────────────── */
(function () {
  const L = QuoteLogic;
  const STORAGE_KEY = "shipguarde-quote-v1";
  const TOTAL_STEPS = 4;
  const LOCALES = { IN: "en-IN", GB: "en-GB", DE: "de-DE", AU: "en-AU" };

  const $ = (id) => document.getElementById(id);
  const form = $("quote-form");
  const nextBtn = $("next-btn");
  const backBtn = $("back-btn");

  const state = {
    data: L.emptyQuote(),
    step: 1,
    touched: new Set(),
    serverErrors: {},
    lists: { countries: [], regions: [], cities: [], makes: [], models: [] },
    // Which parent value each dependent list was loaded for.
    listFor: { regions: null, cities: null, models: null },
    loadTokens: { regions: 0, cities: 0, models: 0 },
    postcode: { country: "", value: "", result: null, pending: false, token: 0, timer: null },
    premium: { timer: null, controller: null, result: null },
    busy: false,
  };

  // ── Storage (best effort; the form works without it) ──
  function save() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.data)); } catch { /* storage unavailable */ }
  }
  function restore() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? L.normalize(JSON.parse(raw)) : L.emptyQuote();
    } catch {
      return L.emptyQuote();
    }
  }
  function forget() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ }
  }

  // ── API ──
  async function api(path, options = {}) {
    const res = await fetch(`/api/quote/${path}`, {
      method: options.method || "GET",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    return { ok: res.ok, status: res.status, body };
  }

  function announce(msg) {
    const el = $("status");
    el.textContent = "";
    // A fresh node change makes screen readers repeat identical messages.
    setTimeout(() => { el.textContent = msg; }, 50);
  }

  // ── Validation context answered from what the browser has loaded ──
  function ctx() {
    const { lists, listFor, postcode } = state;
    return {
      today: new Date(),
      hasCountry: (c) => lists.countries.some((x) => x.code === c),
      hasRegion: (c, r) => listFor.regions === c && lists.regions.some((x) => x.code === r),
      hasCity: (c, r, city) => listFor.cities === `${c}|${r}` && lists.cities.some((x) => x.code === city),
      checkPostcode: (c, p) => (postcode.country === c && postcode.value === p && !postcode.pending ? postcode.result : null),
      hasMake: (m) => lists.makes.some((x) => x.code === m),
      getModel: (make, model) => (listFor.models === make ? lists.models.find((x) => x.code === model) || null : null),
    };
  }

  // ── Select helpers ──
  function fillSelect(select, placeholder, options, value) {
    select.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = placeholder;
    select.appendChild(ph);
    for (const o of options) {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
      select.appendChild(opt);
    }
    select.value = options.some((o) => o.value === value) ? value : "";
  }

  function setLoading(select, text) {
    fillSelect(select, text, [], "");
    select.disabled = true;
    select.setAttribute("aria-busy", "true");
  }

  function setWaiting(select, text) {
    fillSelect(select, text, [], "");
    select.disabled = true;
    select.removeAttribute("aria-busy");
  }

  const DEPENDENT_LISTS = {
    regions: {
      select: "region", field: "region", noun: "states or regions",
      placeholder: "Select a state or region", waiting: "Select a country first",
      parentKey: (d) => d.country,
      url: (d) => `regions?country=${encodeURIComponent(d.country)}`,
    },
    cities: {
      select: "city", field: "city", noun: "cities",
      placeholder: "Select a city", waiting: "Select a state or region first",
      parentKey: (d) => (d.country && d.region ? `${d.country}|${d.region}` : ""),
      url: (d) => `cities?country=${encodeURIComponent(d.country)}&region=${encodeURIComponent(d.region)}`,
    },
    models: {
      select: "model", field: "model", noun: "models",
      placeholder: "Select a model", waiting: "Select a make first",
      parentKey: (d) => d.make,
      url: (d) => `models?make=${encodeURIComponent(d.make)}`,
    },
  };

  /** Load a dependent list for the current parent value. Stale responses are dropped. */
  async function loadList(kind) {
    const cfg = DEPENDENT_LISTS[kind];
    const select = $(cfg.select);
    const retry = document.querySelector(`[data-retry="${cfg.select}"]`);
    const parent = cfg.parentKey(state.data);
    const token = ++state.loadTokens[kind];
    state.lists[kind] = [];
    state.listFor[kind] = null;
    retry.hidden = true;

    if (!parent) {
      setWaiting(select, cfg.waiting);
      return;
    }
    setLoading(select, `Loading ${cfg.noun}...`);
    announce(`Loading ${cfg.noun}.`);

    let res;
    try {
      res = await api(cfg.url(state.data));
    } catch {
      res = { ok: false };
    }
    if (token !== state.loadTokens[kind]) return;

    select.removeAttribute("aria-busy");
    if (!res.ok || !Array.isArray(res.body)) {
      setWaiting(select, `Could not load ${cfg.noun}`);
      retry.hidden = false;
      showFieldError(cfg.field, `We could not load the ${cfg.noun}. Select Retry to try again.`);
      return;
    }
    state.lists[kind] = res.body;
    state.listFor[kind] = parent;
    fillSelect(select, cfg.placeholder, res.body.map((x) => ({ value: x.code, label: x.name })), state.data[cfg.field]);
    select.disabled = false;
    if (kind === "models") renderYears();
    refreshErrors();
    announce(`${res.body.length} ${cfg.noun} loaded.`);
  }

  function renderYears() {
    const select = $("year");
    const model = ctx().getModel(state.data.make, state.data.model);
    if (!model) {
      setWaiting(select, "Select a model first");
      return;
    }
    const years = [];
    for (let y = model.yearTo; y >= model.yearFrom; y--) years.push({ value: String(y), label: String(y) });
    fillSelect(select, "Select a year", years, state.data.year);
    select.disabled = false;
  }

  function money(amount, country) {
    const cfg = L.COUNTRY_MONEY[country];
    if (!cfg) return String(amount);
    return new Intl.NumberFormat(LOCALES[country] || "en-GB", {
      style: "currency", currency: cfg.currency,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  }

  function renderExcess() {
    const select = $("excess");
    const cfg = L.COUNTRY_MONEY[state.data.country];
    if (!cfg) {
      setWaiting(select, "Choose your country first");
      return;
    }
    const opts = cfg.excess.map((a) => ({ value: String(a), label: a === 0 ? "None" : money(a, state.data.country) }));
    fillSelect(select, "Select an excess", opts, state.data.excess);
    select.disabled = false;
  }

  // ── Write data to the controls ──
  function renderControls() {
    const d = state.data;
    for (const id of ["fullName", "dob", "email", "phone", "postcode", "companyName"]) {
      const el = $(id);
      if (el.value !== d[id]) el.value = d[id];
    }
    for (const id of ["country", "region", "city", "make", "model", "year", "excess"]) {
      const el = $(id);
      if (el.value !== d[id]) el.value = d[id];
    }
    for (const r of form.querySelectorAll('input[name="usage"]')) r.checked = r.value === d.usage;
    for (const r of form.querySelectorAll('input[name="coverType"]')) r.checked = r.value === d.coverType;

    const business = d.usage === "business";
    $("companyName-field").hidden = !business;

    const allowed = L.allowedAddons(d.coverType);
    $("addons-group").hidden = !d.coverType;
    $("addons-note").hidden = !d.coverType || d.coverType === "comprehensive";
    for (const label of form.querySelectorAll("[data-addon]")) {
      const box = label.querySelector("input");
      const ok = allowed.includes(box.value);
      label.hidden = !ok;
      box.disabled = !ok;
      box.checked = ok && d.addons.includes(box.value);
    }
  }

  // ── Errors ──
  function controlsFor(field) {
    if (field === "usage" || field === "coverType" || field === "addons") {
      return [...form.querySelectorAll(`input[name="${field}"]`)];
    }
    const el = $(field);
    return el ? [el] : [];
  }

  function showFieldError(field, message) {
    const el = $(`${field}-error`);
    if (!el) return;
    if (el.textContent !== message) el.textContent = message || "";
    for (const c of controlsFor(field)) {
      if (message) c.setAttribute("aria-invalid", "true");
      else c.removeAttribute("aria-invalid");
    }
    const wrap = el.closest(".field");
    if (wrap) wrap.classList.toggle("has-error", !!message);
  }

  function currentErrors(step) {
    if (step < 1 || step > TOTAL_STEPS) return {};
    const errors = L.validateStep(step, state.data, ctx());
    return { ...errors, ...pick(state.serverErrors, L.STEPS[step - 1].fields) };
  }

  function pick(obj, keys) {
    const out = {};
    for (const k of keys) if (obj[k]) out[k] = obj[k];
    return out;
  }

  /** Show errors only for fields the user has finished with, or all after a Next attempt. */
  function refreshErrors() {
    if (state.step > TOTAL_STEPS) return;
    const errors = currentErrors(state.step);
    for (const field of L.STEPS[state.step - 1].fields) {
      let msg = state.touched.has(field) ? errors[field] || "" : "";
      // A postcode check still in flight is not an error yet.
      if (field === "postcode" && (state.postcode.pending || state.postcode.timer)) msg = "";
      showFieldError(field, msg);
    }
  }

  function focusField(field) {
    const controls = controlsFor(field).filter((c) => !c.disabled);
    const target = controls.find((c) => c.checked) || controls[0];
    if (target) target.focus();
  }

  // ── Postcode check ──
  function postcodeStatus(text) {
    $("postcode-status").textContent = text;
  }

  function resetPostcodeCheck() {
    const pc = state.postcode;
    clearTimeout(pc.timer);
    pc.timer = null;
    pc.token++;
    pc.country = "";
    pc.value = "";
    pc.result = null;
    pc.pending = false;
    postcodeStatus("");
  }

  function schedulePostcodeCheck(delay) {
    const pc = state.postcode;
    clearTimeout(pc.timer);
    pc.timer = null;
    if (!state.data.postcode || !state.data.country) {
      pc.token++;
      pc.pending = false;
      postcodeStatus("");
      return;
    }
    pc.timer = setTimeout(() => { pc.timer = null; checkPostcode(); }, delay);
  }

  /** Ask the server whether the postcode fits the country. Resolves when done. */
  async function checkPostcode() {
    const pc = state.postcode;
    const { country, postcode } = state.data;
    if (!country || !postcode) return;
    if (pc.country === country && pc.value === postcode && !pc.pending && pc.result !== null) return;

    const token = ++pc.token;
    pc.pending = true;
    pc.country = country;
    pc.value = postcode;
    pc.result = null;
    postcodeStatus("Checking postcode...");
    $("postcode").setAttribute("aria-busy", "true");

    let res;
    try {
      res = await api(`postcode?country=${encodeURIComponent(country)}&postcode=${encodeURIComponent(postcode)}`);
    } catch {
      res = { ok: false };
    }
    if (token !== pc.token) return;
    pc.pending = false;
    $("postcode").removeAttribute("aria-busy");

    if (!res.ok || !res.body) {
      pc.country = "";
      pc.value = "";
      postcodeStatus("");
      showFieldError("postcode", "We could not check your postcode. Try again.");
      return;
    }
    if (res.body.valid) {
      // Store the tidy form (for example "SW1A 1AA") and remember it passed.
      state.data.postcode = res.body.postcode;
      pc.value = res.body.postcode;
      pc.result = "";
      $("postcode").value = res.body.postcode;
      postcodeStatus("Postcode checked.");
      save();
    } else {
      pc.result = res.body.error;
      postcodeStatus("");
    }
    state.touched.add("postcode");
    refreshErrors();
  }

  // ── Premium ──
  function premiumView(text, busy) {
    $("premium").setAttribute("aria-busy", busy ? "true" : "false");
    $("premium").classList.toggle("is-loading", !!busy);
    $("premium-value").textContent = text;
    if (busy || !state.premium.result) $("premium-breakdown").innerHTML = "";
  }

  function schedulePremium() {
    const p = state.premium;
    clearTimeout(p.timer);
    if (p.controller) p.controller.abort();
    p.controller = null;
    p.result = null;
    if (!state.data.coverType) {
      premiumView("Choose a cover type to see your price.", false);
      return;
    }
    premiumView("Updating your price...", true);
    p.timer = setTimeout(fetchPremium, 400);
  }

  async function fetchPremium() {
    const p = state.premium;
    const controller = new AbortController();
    p.controller = controller;
    let res;
    try {
      res = await api("premium", { method: "POST", body: state.data, signal: controller.signal });
    } catch (err) {
      if (err && err.name === "AbortError") return;
      res = { ok: false, status: 0 };
    }
    if (p.controller !== controller) return;
    p.controller = null;

    if (res.ok && res.body) {
      p.result = res.body;
      renderPremium(res.body);
    } else if (res.status === 400) {
      premiumView("Fix the highlighted answers to see your price.", false);
      if (res.body && res.body.errors) applyServerErrors(res.body.errors, false);
    } else {
      premiumView("We could not get a price right now. Change an option to try again.", false);
    }
  }

  function renderPremium(premium) {
    const c = state.data.country;
    premiumView(`${money(premium.annual, c)} a year, or ${money(premium.monthly, c)} a month`, false);
    const list = $("premium-breakdown");
    list.innerHTML = "";
    const rows = [["Cover", premium.breakdown.cover], ...premium.breakdown.addons.map((a) => [a.label, a.amount])];
    for (const [label, amount] of rows) {
      const li = document.createElement("li");
      li.textContent = `${label}: ${money(amount, c)}`;
      list.appendChild(li);
    }
  }

  // ── Review ──
  const nameOf = (list, code) => (list.find((x) => x.code === code) || {}).name || code;

  function formatDob(iso) {
    const d = L.parseIsoDate(iso);
    if (!d) return iso;
    return new Date(Date.UTC(d.y, d.m - 1, d.d)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  }

  function renderReview() {
    const d = state.data;
    const { lists } = state;
    const label = (arr, code) => (arr.find((x) => x.code === code) || {}).label || code;
    const sections = [
      [1, "About you", [
        ["Full name", d.fullName], ["Date of birth", formatDob(d.dob)], ["Email address", d.email], ["Phone number", d.phone],
      ]],
      [2, "Address", [
        ["Country", nameOf(lists.countries, d.country)], ["State or region", nameOf(lists.regions, d.region)],
        ["City", nameOf(lists.cities, d.city)], ["Postcode", d.postcode],
      ]],
      [3, "Vehicle", [
        ["Make", nameOf(lists.makes, d.make)], ["Model", nameOf(lists.models, d.model)], ["Year of manufacture", d.year],
        ["Usage", label(L.USAGES, d.usage)],
        ...(d.usage === "business" ? [["Company name", d.companyName]] : []),
      ]],
      [4, "Cover", [
        ["Cover type", label(L.COVER_TYPES, d.coverType)],
        ["Add-ons", d.addons.length ? d.addons.map((a) => label(L.ADDONS, a)).join(", ") : "None"],
        ["Voluntary excess", d.excess === "0" ? "None" : money(Number(d.excess), d.country)],
      ]],
    ];

    const root = $("review");
    root.innerHTML = "";
    for (const [step, title, rows] of sections) {
      const sec = document.createElement("section");
      sec.className = "review-section";
      const head = document.createElement("div");
      head.className = "review-head";
      const h3 = document.createElement("h3");
      h3.textContent = title;
      const change = document.createElement("button");
      change.type = "button";
      change.className = "link-btn";
      change.dataset.goto = String(step);
      change.textContent = `Change ${title.toLowerCase()}`;
      head.append(h3, change);
      const dl = document.createElement("dl");
      for (const [k, v] of rows) {
        const dt = document.createElement("dt");
        dt.textContent = k;
        const dd = document.createElement("dd");
        dd.textContent = v;
        dl.append(dt, dd);
      }
      sec.append(head, dl);
      root.appendChild(sec);
    }

    const price = state.premium.result;
    if (price) {
      const p = document.createElement("p");
      p.className = "review-price";
      p.textContent = `Estimated price: ${money(price.annual, d.country)} a year, or ${money(price.monthly, d.country)} a month.`;
      root.appendChild(p);
    }
  }

  // ── Navigation ──
  function stepFromUrl() {
    return new URLSearchParams(location.search).get("step");
  }

  function renderStep() {
    for (const sec of form.querySelectorAll(".step")) {
      sec.hidden = Number(sec.dataset.step) !== state.step;
    }
    for (const li of document.querySelectorAll("[data-progress]")) {
      const n = Number(li.dataset.progress);
      const status = n < state.step ? "done" : n === state.step ? "current" : "todo";
      li.className = `is-${status}`;
      if (status === "current") li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
      li.querySelector(".progress-state").textContent =
        status === "done" ? " (completed)" : status === "current" ? " (current step)" : "";
    }
    backBtn.hidden = state.step === 1;
    nextBtn.textContent = state.step === L.REVIEW_STEP ? "Submit quote request" : "Next";
    $("submit-error").textContent = "";
    if (state.step === 4) {
      renderExcess();
      renderControls();
      if (!state.premium.result) schedulePremium();
      else renderPremium(state.premium.result);
    }
    if (state.step === L.REVIEW_STEP) renderReview();
    refreshErrors();
  }

  /** Show `step`, guarded so no step past the first invalid one can be shown. */
  function goTo(step, { push = true, focus = true } = {}) {
    const target = L.resolveStep(step, state.data, ctx());
    state.step = target;
    const url = `/quote?step=${target}`;
    if (push && `${location.pathname}${location.search}` !== url) history.pushState({ step: target }, "", url);
    else history.replaceState({ step: target }, "", url);
    renderStep();
    if (focus) $(`step-${target}-title`).focus();
    announce(target === L.REVIEW_STEP ? "Check your answers." : `Step ${target} of ${TOTAL_STEPS}: ${L.STEPS[target - 1].title}.`);
  }

  async function onNext() {
    if (state.busy) return;
    if (state.step === L.REVIEW_STEP) return submit();

    state.busy = true;
    nextBtn.disabled = true;
    try {
      if (state.step === 2 && state.data.postcode && state.data.country) {
        clearTimeout(state.postcode.timer);
        state.postcode.timer = null;
        await checkPostcode();
      }
      const fields = L.STEPS[state.step - 1].fields;
      fields.forEach((f) => state.touched.add(f));
      const errors = currentErrors(state.step);
      refreshErrors();
      const first = fields.find((f) => errors[f]);
      if (first) {
        focusField(first);
        return;
      }
      goTo(state.step + 1);
    } finally {
      state.busy = false;
      nextBtn.disabled = false;
    }
  }

  function applyServerErrors(errors, navigate) {
    state.serverErrors = { ...errors };
    for (const f of Object.keys(errors)) state.touched.add(f);
    const fields = Object.keys(errors);
    if (!fields.length) return;
    const step = Math.min(...fields.map(L.stepOfField));
    if (navigate) {
      state.step = step;
      history.pushState({ step }, "", `/quote?step=${step}`);
      renderStep();
      const first = L.STEPS[step - 1].fields.find((f) => errors[f]);
      if (first) focusField(first);
    } else {
      refreshErrors();
    }
  }

  async function submit() {
    state.busy = true;
    nextBtn.disabled = true;
    nextBtn.textContent = "Submitting...";
    $("submit-error").textContent = "";
    let res;
    try {
      res = await api("submit", { method: "POST", body: state.data });
    } catch {
      res = { ok: false, status: 0 };
    } finally {
      state.busy = false;
      nextBtn.disabled = false;
      nextBtn.textContent = "Submit quote request";
    }

    if (res.status === 201 && res.body) {
      showConfirmation(res.body);
    } else if (res.status === 400 && res.body && res.body.errors) {
      applyServerErrors(res.body.errors, true);
      announce("Some answers need fixing before you can submit.");
    } else {
      $("submit-error").textContent = "We could not submit your quote request. Try again.";
    }
  }

  function showConfirmation(body) {
    const country = state.data.country;
    forget();
    form.hidden = true;
    document.querySelector(".progress").hidden = true;
    $("confirmation").hidden = false;
    $("quote-reference").textContent = body.reference;
    $("confirmation-premium").textContent =
      `Your price is ${money(body.premium.annual, country)} a year, or ${money(body.premium.monthly, country)} a month.`;
    history.replaceState({ confirmed: true }, "", "/quote");
    $("confirmation-title").focus();
    announce(`Quote request received. Your reference is ${body.reference}.`);
  }

  function startOver() {
    state.data = L.emptyQuote();
    state.touched.clear();
    state.serverErrors = {};
    state.premium.result = null;
    resetPostcodeCheck();
    for (const kind of Object.keys(DEPENDENT_LISTS)) loadList(kind);
    renderYears();
    renderExcess();
    renderControls();
    $("confirmation").hidden = true;
    form.hidden = false;
    document.querySelector(".progress").hidden = false;
    goTo(1);
  }

  // ── Input handling ──
  function change(field, value) {
    const before = state.data;
    state.data = L.applyChange(before, field, value);
    if (state.data !== before) state.premium.result = null;
    if (state.serverErrors[field]) delete state.serverErrors[field];
    const changed = (f) => before[f] !== state.data[f];

    if (field === "country" && changed("country")) {
      loadList("regions");
      loadList("cities");
      resetPostcodeCheck();
      renderExcess();
    }
    if (field === "region" && changed("region")) loadList("cities");
    if (field === "make" && changed("make")) {
      loadList("models");
      renderYears();
    }
    if (field === "model" && changed("model")) renderYears();
    if (field === "postcode") {
      if (changed("postcode")) {
        state.postcode.token++;
        state.postcode.pending = false;
        state.postcode.result = null;
        postcodeStatus("");
      }
      schedulePostcodeCheck(600);
    }

    renderControls();
    save();
    if (state.step === 4 && ["coverType", "addons", "excess"].includes(field)) schedulePremium();
    refreshErrors();
  }

  form.addEventListener("input", (e) => {
    const t = e.target;
    if (t.matches('input[type="text"], input[type="email"], input[type="tel"], input[type="date"]')) {
      change(t.name, t.value);
    }
  });

  form.addEventListener("change", (e) => {
    const t = e.target;
    if (t.tagName === "SELECT") {
      state.touched.add(t.name);
      change(t.name, t.value);
    } else if (t.type === "radio") {
      state.touched.add(t.name);
      change(t.name, t.value);
    } else if (t.type === "checkbox" && t.name === "addons") {
      const picked = [...form.querySelectorAll('input[name="addons"]:checked')].map((b) => b.value);
      change("addons", picked);
    } else if (t.type === "date") {
      state.touched.add(t.name);
      change(t.name, t.value);
    }
  });

  form.addEventListener("focusout", (e) => {
    const t = e.target;
    if (!t.name || t.type === "radio" || t.type === "checkbox") return;
    state.touched.add(t.name);
    if (t.name === "postcode") {
      clearTimeout(state.postcode.timer);
      state.postcode.timer = null;
      checkPostcode();
    }
    refreshErrors();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    onNext();
  });

  form.addEventListener("click", (e) => {
    const retry = e.target.closest("[data-retry]");
    if (retry) {
      const kind = { region: "regions", city: "cities", model: "models" }[retry.dataset.retry];
      showFieldError(retry.dataset.retry, "");
      loadList(kind);
      return;
    }
    const jump = e.target.closest("[data-goto]");
    if (jump) goTo(Number(jump.dataset.goto));
  });

  backBtn.addEventListener("click", () => {
    if (state.step > 1) goTo(state.step - 1);
  });

  $("new-quote-btn").addEventListener("click", startOver);

  window.addEventListener("popstate", () => {
    if (!$("confirmation").hidden) {
      startOver();
      return;
    }
    goTo(stepFromUrl() || 1, { push: false });
  });

  // ── Start ──
  async function init() {
    state.data = restore();
    let countries;
    let makes;
    try {
      [countries, makes] = await Promise.all([api("countries"), api("makes")]);
    } catch {
      countries = { ok: false };
    }
    if (!countries.ok || !makes || !makes.ok) {
      $("quote-loading").hidden = true;
      $("quote-fatal").hidden = false;
      $("quote-fatal").textContent = "We could not load the quote form. Reload the page to try again.";
      return;
    }
    state.lists.countries = countries.body;
    state.lists.makes = makes.body;
    fillSelect($("country"), "Select a country", countries.body.map((c) => ({ value: c.code, label: c.name })), state.data.country);
    fillSelect($("make"), "Select a make", makes.body.map((m) => ({ value: m.code, label: m.name })), state.data.make);

    // Rebuild the dependent lists for a restored quote before deciding which step to show.
    if (!ctx().hasCountry(state.data.country)) state.data = L.applyChange(state.data, "country", "");
    if (!ctx().hasMake(state.data.make)) state.data = L.applyChange(state.data, "make", "");
    await Promise.all([
      loadList("regions").then(() => loadList("cities")),
      loadList("models"),
      checkPostcode(),
    ]);
    renderYears();
    renderExcess();
    renderControls();
    state.touched.clear();

    $("quote-loading").hidden = true;
    $("quote-flow").hidden = false;
    goTo(stepFromUrl() || 1, { push: false, focus: false });
    refreshErrors();
  }

  init();
})();
