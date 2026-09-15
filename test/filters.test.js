const { test } = require("node:test");
const assert = require("node:assert/strict");
const { applyFilters } = require("../filters.js");

const ROWS = [
  { id: "1", name: "Homepage smoke test", url: "https://acme.io",          status: "passed", priority: "high",     owner: "Alice", updatedAt: "2026-04-16T09:00:00Z" },
  { id: "2", name: "Checkout flow",       url: "https://acme.io/checkout", status: "failed", priority: "critical", owner: "Bob",   updatedAt: "2026-04-15T09:00:00Z" },
  { id: "3", name: "Login regression",    url: "https://acme.io/login",    status: "failed", priority: "medium",   owner: "Alice", updatedAt: "2026-04-14T09:00:00Z" },
];
const GROUPS = ["status", "priority", "owner"];
const newestFirst = { key: "updatedAt", direction: "desc" };
const ids = (rows) => rows.map((r) => r.id);

test("no filters returns every row, newest first", () => {
  const out = applyFilters(ROWS, { status: [], priority: [], owner: [], search: "" }, newestFirst, GROUPS);
  assert.deepEqual(ids(out), ["1", "2", "3"]);
});

test("a group filter keeps only matching rows", () => {
  const out = applyFilters(ROWS, { status: ["failed"], priority: [], owner: [], search: "" }, newestFirst, GROUPS);
  assert.deepEqual(ids(out), ["2", "3"]);
});

test("group filters combine with AND", () => {
  const out = applyFilters(ROWS, { status: ["failed"], priority: [], owner: ["Alice"], search: "" }, newestFirst, GROUPS);
  assert.deepEqual(ids(out), ["3"]);
});

test("search matches name or url, case-insensitively", () => {
  const byName = applyFilters(ROWS, { status: [], priority: [], owner: [], search: "LOGIN" }, newestFirst, GROUPS);
  assert.deepEqual(ids(byName), ["3"]);
  const byUrl = applyFilters(ROWS, { status: [], priority: [], owner: [], search: "/checkout" }, newestFirst, GROUPS);
  assert.deepEqual(ids(byUrl), ["2"]);
});

test("sorting by a string column is case-insensitive and reversible", () => {
  const asc = applyFilters(ROWS, { status: [], priority: [], owner: [], search: "" }, { key: "name", direction: "asc" }, GROUPS);
  assert.deepEqual(ids(asc), ["2", "1", "3"]);
  const desc = applyFilters(ROWS, { status: [], priority: [], owner: [], search: "" }, { key: "name", direction: "desc" }, GROUPS);
  assert.deepEqual(ids(desc), ["3", "1", "2"]);
});

test("does not mutate the input array", () => {
  const copy = [...ROWS];
  applyFilters(ROWS, { status: [], priority: [], owner: [], search: "" }, { key: "name", direction: "asc" }, GROUPS);
  assert.deepEqual(ROWS, copy);
});
