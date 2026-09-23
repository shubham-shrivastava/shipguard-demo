/* Mock catalog for the car insurance quote API. Server side only. */

const COUNTRIES = [
  {
    code: "IN", name: "India",
    postcode: { pattern: /^[1-9]\d{5}$/, hint: "6 digits, for example 411001", normalize: (s) => s.replace(/\s+/g, "") },
    regions: [
      { code: "MH", name: "Maharashtra", cities: [["pune", "Pune"], ["mumbai", "Mumbai"], ["nagpur", "Nagpur"]] },
      { code: "KA", name: "Karnataka", cities: [["bengaluru", "Bengaluru"], ["mysuru", "Mysuru"], ["mangaluru", "Mangaluru"]] },
      { code: "DL", name: "Delhi", cities: [["new-delhi", "New Delhi"], ["dwarka", "Dwarka"]] },
      { code: "TN", name: "Tamil Nadu", cities: [["chennai", "Chennai"], ["coimbatore", "Coimbatore"], ["madurai", "Madurai"]] },
    ],
  },
  {
    code: "GB", name: "United Kingdom",
    postcode: {
      pattern: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/,
      hint: "for example SW1A 1AA",
      normalize: (s) => {
        const compact = s.replace(/\s+/g, "").toUpperCase();
        return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
      },
    },
    regions: [
      { code: "ENG", name: "England", cities: [["london", "London"], ["manchester", "Manchester"], ["bristol", "Bristol"]] },
      { code: "SCT", name: "Scotland", cities: [["edinburgh", "Edinburgh"], ["glasgow", "Glasgow"], ["aberdeen", "Aberdeen"]] },
      { code: "WLS", name: "Wales", cities: [["cardiff", "Cardiff"], ["swansea", "Swansea"]] },
      { code: "NIR", name: "Northern Ireland", cities: [["belfast", "Belfast"], ["derry", "Derry"]] },
    ],
  },
  {
    code: "DE", name: "Germany",
    postcode: { pattern: /^\d{5}$/, hint: "5 digits, for example 10115", normalize: (s) => s.replace(/\s+/g, "") },
    regions: [
      { code: "BE", name: "Berlin", cities: [["berlin", "Berlin"]] },
      { code: "BY", name: "Bavaria", cities: [["munich", "Munich"], ["nuremberg", "Nuremberg"], ["augsburg", "Augsburg"]] },
      { code: "NW", name: "North Rhine-Westphalia", cities: [["cologne", "Cologne"], ["dusseldorf", "Dusseldorf"], ["dortmund", "Dortmund"]] },
    ],
  },
  {
    code: "AU", name: "Australia",
    postcode: { pattern: /^\d{4}$/, hint: "4 digits, for example 2000", normalize: (s) => s.replace(/\s+/g, "") },
    regions: [
      { code: "NSW", name: "New South Wales", cities: [["sydney", "Sydney"], ["newcastle", "Newcastle"], ["wollongong", "Wollongong"]] },
      { code: "VIC", name: "Victoria", cities: [["melbourne", "Melbourne"], ["geelong", "Geelong"]] },
      { code: "QLD", name: "Queensland", cities: [["brisbane", "Brisbane"], ["gold-coast", "Gold Coast"], ["cairns", "Cairns"]] },
    ],
  },
];

// group: rating group from 1 (cheap to insure) to 4 (expensive).
const MAKES = [
  {
    code: "toyota", name: "Toyota",
    models: [
      { code: "corolla", name: "Corolla", yearFrom: 2012, yearTo: 2026, group: 2 },
      { code: "yaris", name: "Yaris", yearFrom: 2014, yearTo: 2026, group: 1 },
      { code: "rav4", name: "RAV4", yearFrom: 2016, yearTo: 2026, group: 3 },
    ],
  },
  {
    code: "honda", name: "Honda",
    models: [
      { code: "civic", name: "Civic", yearFrom: 2012, yearTo: 2026, group: 2 },
      { code: "jazz", name: "Jazz", yearFrom: 2010, yearTo: 2022, group: 1 },
      { code: "cr-v", name: "CR-V", yearFrom: 2015, yearTo: 2026, group: 3 },
    ],
  },
  {
    code: "maruti-suzuki", name: "Maruti Suzuki",
    models: [
      { code: "swift", name: "Swift", yearFrom: 2011, yearTo: 2026, group: 1 },
      { code: "baleno", name: "Baleno", yearFrom: 2015, yearTo: 2026, group: 1 },
      { code: "brezza", name: "Brezza", yearFrom: 2016, yearTo: 2026, group: 2 },
    ],
  },
  {
    code: "volkswagen", name: "Volkswagen",
    models: [
      { code: "polo", name: "Polo", yearFrom: 2010, yearTo: 2024, group: 1 },
      { code: "golf", name: "Golf", yearFrom: 2013, yearTo: 2026, group: 2 },
      { code: "tiguan", name: "Tiguan", yearFrom: 2016, yearTo: 2026, group: 3 },
    ],
  },
  {
    code: "tesla", name: "Tesla",
    models: [
      { code: "model-3", name: "Model 3", yearFrom: 2019, yearTo: 2026, group: 4 },
      { code: "model-y", name: "Model Y", yearFrom: 2020, yearTo: 2026, group: 4 },
    ],
  },
];

const byCode = (list, code) => list.find((x) => x.code === code) || null;

function getCountry(code) { return byCode(COUNTRIES, code); }
function getRegion(country, region) {
  const c = getCountry(country);
  return c ? byCode(c.regions, region) : null;
}
function getCity(country, region, city) {
  const r = getRegion(country, region);
  const hit = r ? r.cities.find(([code]) => code === city) : null;
  return hit ? { code: hit[0], name: hit[1] } : null;
}
function getMake(code) { return byCode(MAKES, code); }
function getModel(make, model) {
  const m = getMake(make);
  return m ? byCode(m.models, model) : null;
}

/**
 * @returns {{valid: true, postcode: string} | {valid: false, error: string}}
 */
function checkPostcode(country, raw) {
  const c = getCountry(country);
  if (!c) return { valid: false, error: "Choose a country before entering a postcode." };
  const value = String(raw || "").trim();
  if (!value) return { valid: false, error: "Enter your postcode." };
  const normalized = c.postcode.normalize(value.toUpperCase());
  if (!c.postcode.pattern.test(normalized)) {
    return { valid: false, error: `Enter a valid ${c.name} postcode, ${c.postcode.hint}.` };
  }
  return { valid: true, postcode: normalized };
}

/** The ctx object quote-logic's validators expect, answered from this catalog. */
function serverContext(today = new Date()) {
  return {
    today,
    hasCountry: (c) => !!getCountry(c),
    hasRegion: (c, r) => !!getRegion(c, r),
    hasCity: (c, r, city) => !!getCity(c, r, city),
    checkPostcode: (c, p) => {
      const res = checkPostcode(c, p);
      return res.valid ? "" : res.error;
    },
    hasMake: (m) => !!getMake(m),
    getModel: (make, model) => getModel(make, model),
  };
}

module.exports = {
  COUNTRIES, MAKES,
  getCountry, getRegion, getCity, getMake, getModel,
  checkPostcode, serverContext,
};
