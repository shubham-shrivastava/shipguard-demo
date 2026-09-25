/* <country-select>: a custom dropdown that renders its trigger and listbox
   inside shadow DOM, like the design-system selects enterprise apps ship.
   Keyboard and mouse both work; the chosen value is exposed via .value and
   a bubbling composed "change" event. */

(() => {
  "use strict";

  const COUNTRIES = ["Australia", "Germany", "India", "Japan", "Singapore", "United Kingdom", "United States"];

  const css = `
    :host { display: block; position: relative; font: inherit; }
    button.trigger {
      font: inherit; font-size: 0.88rem;
      width: 100%; text-align: left;
      padding: 8px 10px;
      border-radius: 5px;
      border: 1px solid #2d3250;
      background: #0f1117;
      color: #e2e8f0;
      cursor: pointer;
      display: flex; justify-content: space-between; align-items: center;
    }
    button.trigger:focus { outline: none; border-color: #7c83ff; }
    .placeholder { color: #4a5568; }
    ul {
      list-style: none; margin: 0; padding: 4px;
      position: absolute; left: 0; right: 0; top: calc(100% + 4px);
      background: #1a1d27;
      border: 1px solid #4b5494;
      border-radius: 6px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      z-index: 400;
      max-height: 220px; overflow-y: auto;
    }
    li {
      padding: 7px 10px; border-radius: 4px; cursor: pointer;
      font-size: 0.86rem; color: #e2e8f0;
    }
    li:hover, li.focused { background: #22263a; }
    li[aria-selected="true"] { color: #a5b4fc; font-weight: 600; }
    .hidden { display: none; }
  `;

  class CountrySelect extends HTMLElement {
    constructor() {
      super();
      this._value = "";
      const root = this.attachShadow({ mode: "open" });
      // A <style> element inside the shadow root would be blocked by the
      // page's CSP (style-src 'self'); a constructed stylesheet is not.
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      root.adoptedStyleSheets = [sheet];

      this._trigger = document.createElement("button");
      this._trigger.type = "button";
      this._trigger.className = "trigger";
      this._trigger.setAttribute("aria-haspopup", "listbox");
      this._trigger.setAttribute("aria-expanded", "false");
      root.appendChild(this._trigger);

      this._list = document.createElement("ul");
      this._list.setAttribute("role", "listbox");
      this._list.className = "hidden";
      for (const name of COUNTRIES) {
        const li = document.createElement("li");
        li.setAttribute("role", "option");
        li.dataset.value = name;
        li.textContent = name;
        this._list.appendChild(li);
      }
      root.appendChild(this._list);

      this._renderTrigger();
      this._trigger.addEventListener("click", () => this._toggle());
      this._trigger.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this._open();
          this._focusIndex(0);
        }
      });
      this._list.addEventListener("click", (e) => {
        const li = e.target.closest("li");
        if (li) this._choose(li.dataset.value);
      });
      this._list.addEventListener("keydown", (e) => this._listKeys(e));
      document.addEventListener("click", (e) => {
        if (!e.composedPath().includes(this)) this._close();
      });
    }

    get value() { return this._value; }
    set value(v) {
      this._value = COUNTRIES.includes(v) ? v : "";
      this._renderTrigger();
    }

    _renderTrigger() {
      this._trigger.innerHTML = "";
      const label = document.createElement("span");
      if (this._value) {
        label.textContent = this._value;
      } else {
        label.className = "placeholder";
        label.textContent = "Select a country";
      }
      const caret = document.createElement("span");
      caret.textContent = "▾";
      this._trigger.append(label, caret);
      for (const li of this._list.children) {
        li.setAttribute("aria-selected", li.dataset.value === this._value ? "true" : "false");
      }
    }

    _toggle() { this._list.classList.contains("hidden") ? this._open() : this._close(); }
    _open() {
      this._list.classList.remove("hidden");
      this._trigger.setAttribute("aria-expanded", "true");
    }
    _close() {
      this._list.classList.add("hidden");
      this._trigger.setAttribute("aria-expanded", "false");
      for (const li of this._list.children) li.classList.remove("focused");
    }
    _choose(v) {
      this.value = v;
      this._close();
      this._trigger.focus();
      this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    }
    _focusIndex(i) {
      const items = [...this._list.children];
      items.forEach((li, n) => li.classList.toggle("focused", n === i));
      this._focused = i;
      items[i].scrollIntoView({ block: "nearest" });
    }
    _listKeys(e) {
      const items = [...this._list.children];
      if (e.key === "ArrowDown") { e.preventDefault(); this._focusIndex(Math.min((this._focused ?? -1) + 1, items.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); this._focusIndex(Math.max((this._focused ?? 1) - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); if (this._focused != null) this._choose(items[this._focused].dataset.value); }
      else if (e.key === "Escape") { this._close(); this._trigger.focus(); }
    }
  }

  // The list itself needs to take keyboard events.
  CountrySelect.prototype.connectedCallback = function () {
    this._list.tabIndex = -1;
    this._list.addEventListener("mousedown", () => this._list.focus());
  };

  customElements.define("country-select", CountrySelect);
})();
