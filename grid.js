/* Orders grid: 120 deterministic rows, column sort, per-column filter
   popovers that look identical, pagination, row selection with a bulk bar,
   and inline editing of the Items cell (double-click, Enter commits,
   Escape cancels). All state is client-side and resets on reload. */

(() => {
  "use strict";

  // Deterministic PRNG so every load shows the same data.
  function mulberry32(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(20260925);

  const CUSTOMERS = ["Northwind Traders", "Contoso Ltd", "Fabrikam Inc", "Tailspin Toys",
    "Adventure Works", "Wingtip Toys", "Proseware Inc", "Litware Ltd", "Woodgrove Bank",
    "Alpine Ski House", "Coho Vineyard", "Lucerne Publishing"];
  const REGIONS = ["APAC", "EMEA", "LATAM", "NA"];
  const STATUSES = ["Draft", "Pending", "Approved", "Shipped", "Rejected"];

  const orders = Array.from({ length: 120 }, (_, i) => {
    const items = 1 + Math.floor(rand() * 14);
    const unit = 500 + Math.floor(rand() * 9500);
    const day = 1 + Math.floor(rand() * 24);
    return {
      id: `ORD-${(20260 + i).toString()}`,
      customer: CUSTOMERS[Math.floor(rand() * CUSTOMERS.length)],
      region: REGIONS[Math.floor(rand() * REGIONS.length)],
      status: STATUSES[Math.floor(rand() * STATUSES.length)],
      items,
      unit,
      updated: `2026-09-${String(day).padStart(2, "0")}`,
    };
  });
  const total = (o) => o.items * o.unit;
  const fmt = (n) => "₹" + n.toLocaleString("en-IN");

  const state = {
    search: "",
    sort: { col: "id", dir: 1 },
    filters: { region: new Set(), status: new Set() },
    page: 1,
    pageSize: 25,
    selected: new Set(),
  };

  const body = document.getElementById("grid-body");
  const pager = document.getElementById("grid-pager");
  const toast = document.getElementById("grid-toast");
  const toastText = document.getElementById("grid-toast-text");
  let toastTimer = null;
  function say(text) {
    toastText.textContent = text;
    toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 4000);
  }

  function visibleOrders() {
    let rows = orders.slice();
    const q = state.search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((o) =>
        [o.id, o.customer, o.region, o.status].some((v) => v.toLowerCase().includes(q)),
      );
    }
    for (const col of ["region", "status"]) {
      if (state.filters[col].size) rows = rows.filter((o) => state.filters[col].has(o[col]));
    }
    const { col, dir } = state.sort;
    rows.sort((a, b) => {
      const av = col === "total" ? total(a) : a[col];
      const bv = col === "total" ? total(b) : b[col];
      return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
    });
    return rows;
  }

  const chip = (s) =>
    s === "Approved" || s === "Shipped" ? `<span class="g-chip ok">${s}</span>`
    : s === "Rejected" ? `<span class="g-chip bad">${s}</span>`
    : s === "Pending" ? `<span class="g-chip warn">${s}</span>`
    : `<span class="g-chip">${s}</span>`;

  function render() {
    const rows = visibleOrders();
    const pages = Math.max(1, Math.ceil(rows.length / state.pageSize));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * state.pageSize;
    const pageRows = rows.slice(start, start + state.pageSize);

    body.innerHTML = pageRows.map((o) => `
      <tr data-id="${o.id}">
        <td><input type="checkbox" class="row-check" aria-label="Select ${o.id}" ${state.selected.has(o.id) ? "checked" : ""} /></td>
        <td>${o.id}</td>
        <td>${o.customer}</td>
        <td>${o.region}</td>
        <td>${chip(o.status)}</td>
        <td class="editable" data-field="items" title="Double-click to edit">${o.items}</td>
        <td>${fmt(total(o))}</td>
        <td>${o.updated}</td>
      </tr>`).join("");

    document.getElementById("grid-empty").classList.toggle("hidden", rows.length > 0);
    document.getElementById("grid-count").textContent =
      `${rows.length} of ${orders.length} orders`;

    // Pager: Prev, numbered pages, Next.
    let html = `<button class="g-btn g-btn-sm" data-page="prev" ${state.page === 1 ? "disabled" : ""}>Prev</button>`;
    for (let p = 1; p <= pages; p++) {
      html += `<button class="g-btn g-btn-sm ${p === state.page ? "current" : ""}" data-page="${p}">${p}</button>`;
    }
    html += `<button class="g-btn g-btn-sm" data-page="next" ${state.page === pages ? "disabled" : ""}>Next</button>`;
    pager.innerHTML = html;

    document.querySelectorAll(".th-filter").forEach((b) => {
      b.classList.toggle("filtered", state.filters[b.dataset.filter].size > 0);
    });

    const selPage = document.getElementById("select-page");
    selPage.checked = pageRows.length > 0 && pageRows.every((o) => state.selected.has(o.id));

    const bar = document.getElementById("bulk-bar");
    bar.classList.toggle("hidden", state.selected.size === 0);
    document.getElementById("bulk-count").textContent = `${state.selected.size} selected`;

    document.querySelectorAll(".th-sort").forEach((b) => {
      const active = b.dataset.sort === state.sort.col;
      b.closest("th").setAttribute("aria-sort", active ? (state.sort.dir === 1 ? "ascending" : "descending") : "none");
      b.textContent = b.textContent.replace(/ [↑↓]$/, "") + (active ? (state.sort.dir === 1 ? " ↑" : " ↓") : "");
    });
  }

  // ── Sorting ──
  document.querySelector("thead").addEventListener("click", (e) => {
    const sortBtn = e.target.closest(".th-sort");
    if (sortBtn) {
      const col = sortBtn.dataset.sort;
      if (state.sort.col === col) state.sort.dir *= -1;
      else state.sort = { col, dir: 1 };
      render();
      return;
    }
    const filterBtn = e.target.closest(".th-filter");
    if (filterBtn) toggleFilterPop(filterBtn);
  });

  // ── Filter popovers ──
  let openPop = null;
  function closePop() {
    if (openPop) { openPop.remove(); openPop = null; }
  }
  function toggleFilterPop(btn) {
    const col = btn.dataset.filter;
    if (openPop && openPop.dataset.col === col) { closePop(); return; }
    closePop();
    const values = col === "region" ? REGIONS : STATUSES;
    const pop = document.createElement("div");
    pop.className = "filter-pop";
    pop.dataset.col = col;
    pop.innerHTML = values.map((v) => `
      <label><input type="checkbox" value="${v}" ${state.filters[col].has(v) ? "checked" : ""} /> ${v}</label>`).join("") + `
      <div class="filter-pop-actions">
        <button class="g-btn g-btn-sm g-btn-primary" data-pop="apply">Apply</button>
        <button class="g-btn g-btn-sm" data-pop="clear">Clear</button>
      </div>`;
    btn.closest("th").appendChild(pop);
    openPop = pop;
    pop.addEventListener("click", (e) => {
      const act = e.target.closest("button[data-pop]");
      if (!act) return;
      if (act.dataset.pop === "apply") {
        state.filters[col] = new Set(
          [...pop.querySelectorAll("input:checked")].map((i) => i.value),
        );
      } else {
        state.filters[col] = new Set();
      }
      state.page = 1;
      closePop();
      render();
    });
  }
  document.addEventListener("click", (e) => {
    if (openPop && !e.target.closest(".filter-pop") && !e.target.closest(".th-filter")) closePop();
  });

  // ── Search ──
  document.getElementById("grid-search").addEventListener("input", (e) => {
    state.search = e.target.value;
    state.page = 1;
    render();
  });
  document.getElementById("grid-clear-filters").addEventListener("click", () => {
    state.filters.region.clear();
    state.filters.status.clear();
    state.search = "";
    document.getElementById("grid-search").value = "";
    state.page = 1;
    render();
  });
  document.getElementById("grid-export").addEventListener("click", () =>
    say(`Exported ${visibleOrders().length} orders to CSV`),
  );

  // ── Pagination ──
  pager.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-page]");
    if (!b || b.disabled) return;
    if (b.dataset.page === "prev") state.page -= 1;
    else if (b.dataset.page === "next") state.page += 1;
    else state.page = Number(b.dataset.page);
    render();
  });

  // ── Selection + bulk bar ──
  body.addEventListener("change", (e) => {
    const check = e.target.closest(".row-check");
    if (!check) return;
    const id = check.closest("tr").dataset.id;
    if (check.checked) state.selected.add(id);
    else state.selected.delete(id);
    render();
  });
  document.getElementById("select-page").addEventListener("change", (e) => {
    const rows = visibleOrders();
    const start = (state.page - 1) * state.pageSize;
    for (const o of rows.slice(start, start + state.pageSize)) {
      if (e.target.checked) state.selected.add(o.id);
      else state.selected.delete(o.id);
    }
    render();
  });
  function bulkSet(status) {
    let n = 0;
    for (const o of orders) {
      if (state.selected.has(o.id)) { o.status = status; n += 1; }
    }
    state.selected.clear();
    render();
    say(`${n} orders ${status.toLowerCase()}`);
  }
  document.getElementById("bulk-approve").addEventListener("click", () => bulkSet("Approved"));
  document.getElementById("bulk-reject").addEventListener("click", () => bulkSet("Rejected"));
  document.getElementById("bulk-export").addEventListener("click", () => {
    say(`Exported ${state.selected.size} selected orders to CSV`);
  });
  document.getElementById("bulk-clear").addEventListener("click", () => {
    state.selected.clear();
    render();
  });

  // ── Inline edit of Items ──
  body.addEventListener("dblclick", (e) => {
    const cell = e.target.closest("td.editable");
    if (!cell || cell.querySelector("input")) return;
    const id = cell.closest("tr").dataset.id;
    const order = orders.find((o) => o.id === id);
    const old = order.items;
    cell.innerHTML = `<input type="number" min="1" max="999" value="${old}" aria-label="Items for ${id}" />`;
    const input = cell.querySelector("input");
    input.focus();
    input.select();
    const commit = () => {
      const v = Math.floor(Number(input.value));
      if (Number.isFinite(v) && v >= 1 && v <= 999) {
        order.items = v;
        say(`${id}: items set to ${v}`);
      }
      render();
    };
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") commit();
      if (ev.key === "Escape") render();
    });
    input.addEventListener("blur", () => render());
  });

  render();
})();
