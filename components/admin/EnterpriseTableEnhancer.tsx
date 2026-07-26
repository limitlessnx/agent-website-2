"use client";

import { useEffect } from "react";

function csvEscape(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function enhance(table: HTMLTableElement) {
  if (table.dataset.enterpriseEnhanced === "true") return;
  table.dataset.enterpriseEnhanced = "true";

  const rows = Array.from(table.tBodies[0]?.rows || []);
  if (!rows.length) return;

  const wrapper = table.closest(".admin-table-wrap") || table.parentElement;
  if (!wrapper) return;
  wrapper.classList.add("enterprise-grid-shell");

  const toolbar = document.createElement("div");
  toolbar.className = "enterprise-grid-toolbar";
  toolbar.innerHTML = `
    <div class="enterprise-grid-search"><span>⌕</span><input type="search" placeholder="Search this table..." aria-label="Search table rows" /></div>
    <div class="enterprise-grid-actions">
      <button type="button" data-grid-action="select">Select all</button>
      <button type="button" data-grid-action="export">Export CSV</button>
      <label>Rows <select aria-label="Rows per page"><option>10</option><option selected>25</option><option>50</option><option>100</option></select></label>
    </div>`;
  wrapper.insertBefore(toolbar, table);

  const footer = document.createElement("div");
  footer.className = "enterprise-grid-footer";
  footer.innerHTML = `<span data-grid-summary></span><div><button type="button" data-grid-prev>Previous</button><button type="button" data-grid-next>Next</button></div>`;
  wrapper.appendChild(footer);

  const input = toolbar.querySelector("input") as HTMLInputElement;
  const select = toolbar.querySelector("select") as HTMLSelectElement;
  const selectButton = toolbar.querySelector('[data-grid-action="select"]') as HTMLButtonElement;
  const exportButton = toolbar.querySelector('[data-grid-action="export"]') as HTMLButtonElement;
  const prev = footer.querySelector("[data-grid-prev]") as HTMLButtonElement;
  const next = footer.querySelector("[data-grid-next]") as HTMLButtonElement;
  const summary = footer.querySelector("[data-grid-summary]") as HTMLElement;
  let page = 0;
  let selected = false;

  const headerRow = table.tHead?.rows[0];
  if (headerRow && !headerRow.querySelector("[data-grid-select-column]")) {
    const th = document.createElement("th");
    th.dataset.gridSelectColumn = "true";
    th.innerHTML = '<input type="checkbox" aria-label="Select all visible rows" />';
    headerRow.insertBefore(th, headerRow.firstChild);
    rows.forEach((row) => {
      const td = document.createElement("td");
      td.dataset.gridSelectColumn = "true";
      td.innerHTML = '<input type="checkbox" aria-label="Select row" />';
      row.insertBefore(td, row.firstChild);
    });
  }

  function filteredRows() {
    const query = input.value.trim().toLowerCase();
    return query ? rows.filter((row) => row.innerText.toLowerCase().includes(query)) : rows;
  }

  function render() {
    const filtered = filteredRows();
    const size = Number(select.value || 25);
    const maxPage = Math.max(0, Math.ceil(filtered.length / size) - 1);
    page = Math.min(page, maxPage);
    const start = page * size;
    const visible = new Set(filtered.slice(start, start + size));
    rows.forEach((row) => { row.hidden = !visible.has(row); });
    const shownFrom = filtered.length ? start + 1 : 0;
    const shownTo = Math.min(filtered.length, start + size);
    summary.textContent = `${shownFrom}-${shownTo} of ${filtered.length} rows`;
    prev.disabled = page === 0;
    next.disabled = page >= maxPage;
  }

  input.addEventListener("input", () => { page = 0; render(); });
  select.addEventListener("change", () => { page = 0; render(); });
  prev.addEventListener("click", () => { page = Math.max(0, page - 1); render(); });
  next.addEventListener("click", () => { page += 1; render(); });
  selectButton.addEventListener("click", () => {
    selected = !selected;
    selectButton.textContent = selected ? "Clear selection" : "Select all";
    rows.filter((row) => !row.hidden).forEach((row) => {
      const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      if (checkbox) checkbox.checked = selected;
    });
  });
  exportButton.addEventListener("click", () => {
    const headings = Array.from(table.tHead?.rows[0]?.cells || []).slice(1).map((cell) => csvEscape(cell.textContent || ""));
    const selectedRows = rows.filter((row) => (row.querySelector('input[type="checkbox"]') as HTMLInputElement | null)?.checked);
    const source = selectedRows.length ? selectedRows : filteredRows();
    const lines = [headings.join(","), ...source.map((row) => Array.from(row.cells).slice(1).map((cell) => csvEscape(cell.innerText)).join(","))];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fluxknight-export-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  });

  render();
}

export default function EnterpriseTableEnhancer() {
  useEffect(() => {
    const apply = () => document.querySelectorAll<HTMLTableElement>("table.admin-table").forEach(enhance);
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
