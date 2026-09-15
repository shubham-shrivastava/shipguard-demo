/* ───────────────────────────────────────────────
   Filter + sort pipeline. Pure functions, no DOM.
   Loaded by the page via <script> and by the tests via require().
   ─────────────────────────────────────────────── */
(function (root) {
  function matchesGroups(row, filters, groupKeys) {
    return groupKeys.every((key) => {
      const selected = filters[key] || [];
      return selected.length === 0 || selected.includes(row[key]);
    });
  }

  function matchesSearch(row, search) {
    const q = (search || "").trim().toLowerCase();
    if (!q) return true;
    return row.name.toLowerCase().includes(q) || row.url.toLowerCase().includes(q);
  }

  function compare(a, b, sortState) {
    let av = a[sortState.key];
    let bv = b[sortState.key];
    if (sortState.key === "updatedAt") {
      av = new Date(av);
      bv = new Date(bv);
    }
    if (typeof av === "string") av = av.toLowerCase();
    if (typeof bv === "string") bv = bv.toLowerCase();
    if (av < bv) return sortState.direction === "asc" ? -1 : 1;
    if (av > bv) return sortState.direction === "asc" ? 1 : -1;
    return 0;
  }

  /**
   * @param {Array<object>} rows
   * @param {{search?: string, [group: string]: string[] | string}} filters
   * @param {{key: string, direction: "asc" | "desc"}} sortState
   * @param {string[]} groupKeys  filter groups to apply, e.g. ["status", "priority", "owner"]
   */
  function applyFilters(rows, filters, sortState, groupKeys) {
    return rows
      .filter((row) => matchesGroups(row, filters, groupKeys))
      .filter((row) => matchesSearch(row, filters.search))
      .sort((a, b) => compare(a, b, sortState));
  }

  const api = { applyFilters };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ShipGuardFilters = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
