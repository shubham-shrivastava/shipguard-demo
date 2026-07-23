/* ───────────────────────────────────────────────
   ShipGuard — Multi-filter Table  (plain JS, no deps)
   ─────────────────────────────────────────────── */

// ── 1. MOCK DATA ─────────────────────────────────────────────────────────────

const MOCK_DATA = [
  { id: "run-001", name: "Homepage smoke test",        url: "https://acme.io",              status: "passed",    priority: "high",     owner: "Alice Chen",    steps: 8,  updatedAt: "2026-04-16T09:12:00Z" },
  { id: "run-002", name: "Checkout flow end-to-end",   url: "https://acme.io/checkout",     status: "failed",    priority: "critical", owner: "Bob Kim",       steps: 14, updatedAt: "2026-04-16T08:55:00Z" },
  { id: "run-003", name: "Login regression",           url: "https://acme.io/login",        status: "passed",    priority: "medium",   owner: "Carol Torres",  steps: 5,  updatedAt: "2026-04-16T07:40:00Z" },
  { id: "run-004", name: "PR #182 diff analysis",      url: "https://github.com/acme/app",  status: "passed",    priority: "high",     owner: "Dave Nguyen",   steps: 3,  updatedAt: "2026-04-15T22:10:00Z" },
  { id: "run-005", name: "Pricing page CTA",           url: "https://acme.io/pricing",      status: "failed",    priority: "medium",   owner: "Alice Chen",    steps: 6,  updatedAt: "2026-04-15T20:05:00Z" },
  { id: "run-006", name: "Search autocomplete",        url: "https://acme.io/search",       status: "pending",   priority: "low",      owner: "Eve Sharma",    steps: 0,  updatedAt: "2026-04-15T18:30:00Z" },
  { id: "run-007", name: "Account settings save",      url: "https://acme.io/settings",     status: "passed",    priority: "medium",   owner: "Bob Kim",       steps: 9,  updatedAt: "2026-04-15T15:20:00Z" },
  { id: "run-008", name: "Mobile nav menu",            url: "https://acme.io",              status: "cancelled", priority: "low",      owner: "Carol Torres",  steps: 0,  updatedAt: "2026-04-15T12:00:00Z" },
  { id: "run-009", name: "API error boundary check",   url: "https://acme.io/api-test",     status: "failed",    priority: "critical", owner: "Dave Nguyen",   steps: 11, updatedAt: "2026-04-14T23:45:00Z" },
  { id: "run-010", name: "Newsletter signup form",     url: "https://acme.io/#newsletter",  status: "passed",    priority: "low",      owner: "Alice Chen",    steps: 4,  updatedAt: "2026-04-14T20:00:00Z" },
  { id: "run-011", name: "PR #190 visual regression",  url: "https://github.com/acme/app",  status: "running",   priority: "high",     owner: "Eve Sharma",    steps: 7,  updatedAt: "2026-04-14T17:15:00Z" },
  { id: "run-012", name: "Password reset flow",        url: "https://acme.io/reset",        status: "passed",    priority: "high",     owner: "Bob Kim",       steps: 7,  updatedAt: "2026-04-14T14:30:00Z" },
  { id: "run-013", name: "404 page fallback",          url: "https://acme.io/notfound",     status: "passed",    priority: "low",      owner: "Carol Torres",  steps: 2,  updatedAt: "2026-04-13T10:00:00Z" },
  { id: "run-014", name: "Dashboard KPI tiles",        url: "https://acme.io/dashboard",    status: "failed",    priority: "medium",   owner: "Alice Chen",    steps: 10, updatedAt: "2026-04-13T09:00:00Z" },
  { id: "run-015", name: "PR #201 auth changes",       url: "https://github.com/acme/app",  status: "pending",   priority: "critical", owner: "Dave Nguyen",   steps: 0,  updatedAt: "2026-04-13T08:20:00Z" },
  { id: "run-016", name: "Onboarding wizard step 1",   url: "https://acme.io/onboarding",   status: "passed",    priority: "medium",   owner: "Eve Sharma",    steps: 12, updatedAt: "2026-04-12T21:10:00Z" },
  { id: "run-017", name: "Onboarding wizard step 2",   url: "https://acme.io/onboarding",   status: "failed",    priority: "medium",   owner: "Eve Sharma",    steps: 12, updatedAt: "2026-04-12T21:20:00Z" },
  { id: "run-018", name: "Billing upgrade flow",       url: "https://acme.io/billing",      status: "passed",    priority: "high",     owner: "Alice Chen",    steps: 8,  updatedAt: "2026-04-11T16:45:00Z" },
  { id: "run-019", name: "Dark mode toggle QA",        url: "https://acme.io",              status: "cancelled", priority: "low",      owner: "Bob Kim",       steps: 0,  updatedAt: "2026-04-11T11:30:00Z" },
  { id: "run-020", name: "Full regression suite",      url: "https://acme.io",              status: "running",   priority: "critical", owner: "Carol Torres",  steps: 42, updatedAt: "2026-04-16T09:20:00Z" },
];

// Derive unique option sets from data
function unique(arr) { return [...new Set(arr)].sort(); }

const FILTER_CONFIG = [
  {
    key: "status",
    label: "Status",
    options: ["passed", "failed", "running", "pending", "cancelled"],
  },
  {
    key: "priority",
    label: "Priority",
    options: ["critical", "high", "medium", "low"],
  },
  {
    key: "owner",
    label: "Owner",
    options: unique(MOCK_DATA.map((d) => d.owner)),
  },
];

// ── 2. STATE ──────────────────────────────────────────────────────────────────

const filters = {
  status:   [],
  priority: [],
  owner:    [],
  search:   "",
};

const sortState = {
  key: "updatedAt",
  direction: "desc",
};

// Track open dropdown key
let openDropdown = null;

// ── 3. TABLE COLUMN DEFINITIONS ───────────────────────────────────────────────

const COLUMNS = [
  { key: "name",      label: "Test Name",  sortable: true,  render: renderName },
  { key: "status",    label: "Status",     sortable: true,  render: renderStatus },
  { key: "priority",  label: "Priority",   sortable: true,  render: renderPriority },
  { key: "owner",     label: "Owner",      sortable: true,  render: renderOwner },
  { key: "steps",     label: "Steps",      sortable: true,  render: renderSteps },
  { key: "updatedAt", label: "Last Run",   sortable: true,  render: renderDate },
];

// ── 4. RENDER HELPERS ─────────────────────────────────────────────────────────

function renderName(row) {
  return `<td>
    <div class="cell-name">${esc(row.name)}</div>
    <div class="cell-url" title="${esc(row.url)}">${esc(row.url)}</div>
  </td>`;
}

function renderStatus(row) {
  const labels = { passed: "Passed", failed: "Failed", running: "Running", pending: "Pending", cancelled: "Cancelled" };
  const s = row.status.toLowerCase();
  return `<td><span class="badge badge-${s}">${labels[s] ?? s}</span></td>`;
}

function renderPriority(row) {
  const p = row.priority.toLowerCase();
  return `<td><span class="priority-dot priority-${p}">${capitalize(p)}</span></td>`;
}

function renderOwner(row) {
  const initials = row.owner.split(" ").map((n) => n[0]).slice(0, 2).join("");
  return `<td>
    <div class="owner-cell">
      <div class="avatar">${esc(initials)}</div>
      <span>${esc(row.owner)}</span>
    </div>
  </td>`;
}

function renderSteps(row) {
  return `<td class="cell-steps">${row.steps}</td>`;
}

function renderDate(row) {
  const d = new Date(row.updatedAt);
  const rel = timeAgo(d);
  return `<td class="cell-date" title="${d.toLocaleString()}">${rel}</td>`;
}

// ── 5. DATA PIPELINE ──────────────────────────────────────────────────────────

function getFilteredSorted() {
  let rows = MOCK_DATA;

  // Filter by each active group
  for (const { key } of FILTER_CONFIG) {
    if (filters[key].length > 0) {
      rows = rows.filter((r) => filters[key].includes(r[key]));
    }
  }

  // Global search over name + url
  if (filters.search.trim()) {
    const q = filters.search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.url.toLowerCase().includes(q)
    );
  }

  // Sort
  rows = [...rows].sort((a, b) => {
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
  });

  return rows;
}

// ── 6. RENDER TABLE ───────────────────────────────────────────────────────────

function renderTableHead() {
  const tr = document.getElementById("table-head-row");
  tr.innerHTML = COLUMNS.map((col) => {
    let cls = col.sortable ? "sortable" : "";
    let icon = "↕";
    if (sortState.key === col.key) {
      cls += sortState.direction === "asc" ? " sort-asc" : " sort-desc";
      icon = sortState.direction === "asc" ? "↑" : "↓";
    }
    return `<th class="${cls}" data-key="${col.key}">
      ${col.label}
      ${col.sortable ? `<span class="sort-icon">${icon}</span>` : ""}
    </th>`;
  }).join("");

  // Attach sort handlers
  tr.querySelectorAll("th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const k = th.dataset.key;
      if (sortState.key === k) {
        sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
      } else {
        sortState.key = k;
        sortState.direction = "asc";
      }
      render();
    });
  });
}

function renderTableBody(rows) {
  const tbody = document.getElementById("table-body");
  const emptyState = document.getElementById("empty-state");
  const table = document.getElementById("data-table");

  if (rows.length === 0) {
    tbody.innerHTML = "";
    table.classList.add("hidden");
    emptyState.classList.remove("hidden");
    return;
  }

  table.classList.remove("hidden");
  emptyState.classList.add("hidden");

  tbody.innerHTML = rows
    .map(
      (row) =>
        `<tr>${COLUMNS.map((col) => col.render(row)).join("")}</tr>`
    )
    .join("");
}

function renderResultCount(rows) {
  const el = document.getElementById("result-count");
  const total = MOCK_DATA.length;
  el.textContent = rows.length === total
    ? `${total} runs`
    : `${rows.length} of ${total} runs`;
}

// ── 7. MULTISELECT DROPDOWNS ─────────────────────────────────────────────────

function buildMultiselects() {
  const container = document.getElementById("filter-groups");
  container.innerHTML = "";

  for (const cfg of FILTER_CONFIG) {
    const wrap = document.createElement("div");
    wrap.className = "ms-wrap";
    wrap.dataset.key = cfg.key;
    wrap.innerHTML = buildTriggerHTML(cfg);
    container.appendChild(wrap);
  }
}

function buildTriggerHTML(cfg) {
  const count = filters[cfg.key].length;
  const badge = count > 0 ? `<span class="badge">${count}</span>` : "";
  const openCls = openDropdown === cfg.key ? " open" : "";
  return `<button class="ms-trigger${openCls}" data-key="${cfg.key}">
    ${esc(cfg.label)}${badge}
    <span class="arrow">▼</span>
  </button>`;
}

function buildDropdownHTML(cfg) {
  const opts = cfg.options
    .map((opt) => {
      const checked = filters[cfg.key].includes(opt) ? "checked" : "";
      const selCls = filters[cfg.key].includes(opt) ? " selected" : "";
      return `<label class="ms-option${selCls}" data-value="${esc(opt)}">
        <input type="checkbox" ${checked} data-key="${cfg.key}" data-value="${esc(opt)}" />
        ${esc(capitalize(opt))}
      </label>`;
    })
    .join("");

  return `
    <input class="ms-search" type="text" placeholder="Search ${cfg.label.toLowerCase()}…" autocomplete="off" />
    <div class="ms-list">${opts}</div>
    <div class="ms-footer">
      <span></span>
      <button class="ms-clear-link" data-key="${cfg.key}">Clear</button>
    </div>
  `;
}

function openDropdownFor(key) {
  closeAllDropdowns();
  openDropdown = key;

  const wrap = document.querySelector(`.ms-wrap[data-key="${key}"]`);
  const cfg = FILTER_CONFIG.find((c) => c.key === key);

  // Update trigger style
  wrap.querySelector(".ms-trigger").classList.add("open");

  // Create dropdown element
  const dd = document.createElement("div");
  dd.className = "ms-dropdown";
  dd.dataset.key = key;
  dd.innerHTML = buildDropdownHTML(cfg);
  wrap.appendChild(dd);

  // Search within dropdown
  const searchInput = dd.querySelector(".ms-search");
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.toLowerCase();
    dd.querySelectorAll(".ms-option").forEach((opt) => {
      const val = opt.dataset.value.toLowerCase();
      opt.style.display = val.includes(q) ? "" : "none";
    });
    const visibleCount = [...dd.querySelectorAll(".ms-option")].filter(
      (o) => o.style.display !== "none"
    ).length;
    const noResults = dd.querySelector(".ms-no-results");
    if (visibleCount === 0 && !noResults) {
      const nr = document.createElement("div");
      nr.className = "ms-no-results";
      nr.textContent = "No options found";
      dd.querySelector(".ms-list").appendChild(nr);
    } else if (visibleCount > 0 && noResults) {
      noResults.remove();
    }
  });

  // Checkbox toggle
  dd.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", () => {
      const k = cb.dataset.key;
      const v = cb.dataset.value;
      if (cb.checked) {
        if (!filters[k].includes(v)) filters[k].push(v);
      } else {
        filters[k] = filters[k].filter((x) => x !== v);
      }
      cb.closest(".ms-option").classList.toggle("selected", cb.checked);
      updateTriggerBadge(k);
      render();
    });
  });

  // Clear link inside dropdown
  dd.querySelector(".ms-clear-link").addEventListener("click", () => {
    const k = dd.querySelector(".ms-clear-link").dataset.key;
    filters[k] = [];
    render();
    openDropdownFor(k); // reopen fresh
  });

  // Focus search
  searchInput.focus();
}

function closeAllDropdowns() {
  openDropdown = null;
  document.querySelectorAll(".ms-dropdown").forEach((el) => el.remove());
  document.querySelectorAll(".ms-trigger").forEach((el) => el.classList.remove("open"));
}

function updateTriggerBadge(key) {
  const wrap = document.querySelector(`.ms-wrap[data-key="${key}"]`);
  if (!wrap) return;
  const cfg = FILTER_CONFIG.find((c) => c.key === key);
  wrap.querySelector(".ms-trigger").innerHTML = buildTriggerHTML(cfg).replace(
    /^<button[^>]*>/,
    ""
  ).replace(/<\/button>$/, "");
  // Simpler: just replace the whole trigger HTML content
  const trigger = wrap.querySelector(".ms-trigger");
  const count = filters[key].length;
  const badge = count > 0 ? `<span class="badge">${count}</span>` : "";
  trigger.innerHTML = `${esc(cfg.label)}${badge}<span class="arrow">▼</span>`;
}

// ── 8. ACTIVE CHIPS ───────────────────────────────────────────────────────────

function renderChips() {
  const container = document.getElementById("active-chips");
  const clearBtn = document.getElementById("clear-all-btn");

  const chips = [];
  for (const { key, label } of FILTER_CONFIG) {
    for (const val of filters[key]) {
      chips.push({ key, label, val });
    }
  }

  container.innerHTML = chips
    .map(
      ({ key, label, val }) =>
        `<span class="chip">
          <span class="chip-label">${esc(label)}:</span>
          ${esc(capitalize(val))}
          <button class="chip-remove" data-key="${key}" data-val="${esc(val)}" title="Remove filter">×</button>
        </span>`
    )
    .join("");

  container.querySelectorAll(".chip-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const k = btn.dataset.key;
      const v = btn.dataset.val;
      filters[k] = filters[k].filter((x) => x !== v);
      render();
      // If the dropdown for this key is open, refresh it
      if (openDropdown === k) openDropdownFor(k);
    });
  });

  const hasAnyFilter =
    chips.length > 0 || filters.search.trim().length > 0;
  clearBtn.classList.toggle("hidden", !hasAnyFilter);
}

// ── 9. MAIN RENDER ────────────────────────────────────────────────────────────

function render() {
  const rows = getFilteredSorted();
  renderTableHead();
  renderTableBody(rows);
  renderResultCount(rows);
  renderChips();
  rebuildTriggerBadges();
}

function rebuildTriggerBadges() {
  for (const cfg of FILTER_CONFIG) {
    updateTriggerBadge(cfg.key);
    const trigger = document.querySelector(`.ms-trigger[data-key="${cfg.key}"]`);
    if (trigger && openDropdown === cfg.key) trigger.classList.add("open");
  }
}

// ── 10. GLOBAL EVENT WIRING ───────────────────────────────────────────────────

function init() {
  buildMultiselects();
  render();

  // Trigger click → open dropdown
  document.getElementById("filter-groups").addEventListener("click", (e) => {
    const trigger = e.target.closest(".ms-trigger");
    if (!trigger) return;
    const key = trigger.dataset.key;
    if (openDropdown === key) {
      closeAllDropdowns();
    } else {
      openDropdownFor(key);
    }
  });

  // Click outside → close dropdowns
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".ms-wrap") && openDropdown) {
      closeAllDropdowns();
    }
  });

  // Escape → close dropdowns
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openDropdown) closeAllDropdowns();
  });

  // Global search
  document.getElementById("global-search").addEventListener("input", (e) => {
    filters.search = e.target.value;
  });

  // Clear all button
  document.getElementById("clear-all-btn").addEventListener("click", clearAll);
  document.getElementById("empty-clear-btn").addEventListener("click", clearAll);
}

function clearAll() {
  for (const { key } of FILTER_CONFIG) filters[key] = [];
  filters.search = "";
  document.getElementById("global-search").value = "";
  closeAllDropdowns();
  render();
}

// ── 11. UTILS ─────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function timeAgo(date) {
  const secs = Math.floor((Date.now() - date) / 1000);
  if (secs < 60)   return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  const days = Math.floor(secs / 86400);
  if (days === 1) return "yesterday";
  if (days < 7)   return `${days}d ago`;
  return date.toLocaleDateString();
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", init);
