let state = { lat: null, lon: null, address: null, gnafId: null, postcode: null };
let suggestTimer = null;

// ── Address Autocomplete ──────────────────────────────────────────────────────
const searchInput   = document.getElementById("searchInput");
const suggestionList = document.getElementById("suggestionList");

searchInput.addEventListener("input", () => {
  clearTimeout(suggestTimer);
  const q = searchInput.value.trim();
  if (q.length < 3) { hideSuggestions(); return; }
  suggestTimer = setTimeout(() => fetchSuggestions(q), 300);
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrap")) hideSuggestions();
});

async function fetchSuggestions(q) {
  const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
  if (!res.ok) return;
  const items = await res.json();
  suggestionList.innerHTML = "";
  if (!items.length) { hideSuggestions(); return; }
  items.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item.display_name;
    li.addEventListener("click", () => selectAddress(item.gnaf_id, item.display_name));
    suggestionList.appendChild(li);
  });
  suggestionList.hidden = false;
}

function hideSuggestions() { suggestionList.hidden = true; }

// ── Select Address → Load All Data ───────────────────────────────────────────
async function selectAddress(gnafId, label) {
  hideSuggestions();
  searchInput.value = label;

  setContent("propertyContent",  `<p class="loading">Loading…</p>`);
  setContent("aiContent",        `<p class="loading">Loading…</p>`);
  setContent("salesdataContent", `<p class="loading">Loading…</p>`);
  setContent("transportContent", `<p class="loading">Loading…</p>`);
  setContent("schoolsContent",   `<p class="loading">Loading…</p>`);
  setContent("daContent",        `<p class="loading">Loading…</p>`);
  setContent("titleContent",     `<p class="loading">Loading…</p>`);
  setContent("bushfireContent",  `<p class="loading">Loading…</p>`);
  setContent("bondContent",      `<p class="loading">Loading…</p>`);
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelector('.tab-btn[data-tab="property"]').classList.add("active");
  document.getElementById("property").classList.add("active");
  document.getElementById("results").hidden = false;

  // Property data (includes geocode)
  const res = await fetch(`/api/property?gnaf_id=${encodeURIComponent(gnafId)}`);
  const data = await res.json();

  if (data.error) { setContent("propertyContent", `<p class="error">${data.error}</p>`); return; }

  const geo = data.geo;
  state = { lat: geo.lat, lon: geo.lon, address: geo.display_name, gnafId: gnafId, postcode: geo.postcode };

  renderAddressHeader(geo);
  renderProperty(data.property, geo);

  // Load remaining tabs in parallel
  loadAI();
  loadSalesData();
  loadTransport();
  loadSchools();
  loadDA();
  loadTitleSearch();
  loadBushfireRisk();
  loadRentalBond();
}

// ── Address Header ────────────────────────────────────────────────────────────
function renderAddressHeader(geo) {
  document.getElementById("addressHeader").innerHTML = `
    <div style="font-weight:600;margin-bottom:.4rem">${geo.display_name}</div>
    <div style="font-size:.82rem;color:#555;display:flex;flex-wrap:wrap;gap:.4rem 1.4rem;">
      <span><span style="color:#888">G-NAF ID </span><span style="font-weight:600;color:#1a202c">${geo.gnaf_id}</span></span>
      <span><span style="color:#888">Lat </span><span style="font-weight:600;color:#1a202c">${geo.lat.toFixed(6)}</span></span>
      <span><span style="color:#888">Lon </span><span style="font-weight:600;color:#1a202c">${geo.lon.toFixed(6)}</span></span>
    </div>`;
}

// ── Property Tab ──────────────────────────────────────────────────────────────
function renderProperty(_prop, geo) {
  setContent("propertyContent", `
    <div class="panel-card">
      <div style="font-weight:600;margin-bottom:.4rem">${geo.display_name}</div>
      <div style="font-size:.82rem;color:#555;display:flex;flex-wrap:wrap;gap:.4rem 1.4rem;">
        <span><span style="color:#888">Suburb </span><span style="font-weight:600;color:#1a202c">${geo.suburb || "—"}</span></span>
        <span><span style="color:#888">Postcode </span><span style="font-weight:600;color:#1a202c">${geo.postcode || "—"}</span></span>
        <span><span style="color:#888">State </span><span style="font-weight:600;color:#1a202c">${geo.state || "—"}</span></span>
        <span><span style="color:#888">G-NAF ID </span><span style="font-weight:600;color:#1a202c">${geo.gnaf_id}</span></span>
        <span><span style="color:#888">Lat </span><span style="font-weight:600;color:#1a202c">${geo.lat.toFixed(6)}</span></span>
        <span><span style="color:#888">Lon </span><span style="font-weight:600;color:#1a202c">${geo.lon.toFixed(6)}</span></span>
      </div>
    </div>`);
}

// ── AI Tab ────────────────────────────────────────────────────────────────────
async function loadAI() {
  const { lat, lon, address } = state;
  const res = await fetch(`/api/ai?lat=${lat}&lon=${lon}&address=${encodeURIComponent(address)}`);
  const data = await res.json();
  if (data.error) { setContent("aiContent", `<p class="error">${data.error}</p>`); return; }
  setContent("aiContent", `
    <div class="panel-card">
      <h3 style="margin-bottom:1rem">Property & Suburb Summary</h3>
      <p class="ai-summary">${escHtml(data.summary || "No summary available.")}</p>
    </div>`);
}

// ── Sales Data Tab ────────────────────────────────────────────────────────────
function formatSaleDate(yyyymmdd) {
  if (!yyyymmdd) return "—";
  const s = String(yyyymmdd);
  if (s.length !== 8) return s;
  return `${s.slice(6,8)}/${s.slice(4,6)}/${s.slice(0,4)}`;
}

async function loadSalesData() {
  const { postcode } = state;
  if (!postcode) { setContent("salesdataContent", `<p class="empty">No postcode available.</p>`); return; }
  const fromVal = document.getElementById("salesDateFrom").value;
  const toVal   = document.getElementById("salesDateTo").value;
  if (!fromVal || !toVal) { setContent("salesdataContent", `<p class="empty">Please select both From and To dates.</p>`); return; }
  const dateFrom = fromVal.replace(/-/g, "");
  const dateTo   = toVal.replace(/-/g, "");
  const res = await fetch(`/api/sales-data?postcode=${encodeURIComponent(postcode)}&date_from=${dateFrom}&date_to=${dateTo}`);
  const data = await res.json();
  if (data.error) { setContent("salesdataContent", `<p class="error">${escHtml(data.error)}</p>`); return; }
  const sales = data.sales || [];
  if (!sales.length) {
    setContent("salesdataContent", `<p class="empty">No sales found for postcode ${escHtml(String(postcode))} in this date range.</p>`);
    return;
  }
  window._salesData = data;
  setContent("salesdataContent", `
    <div class="panel-card">
      <div style="display:flex;align-items:center;gap:.8rem;flex-wrap:wrap;margin-bottom:1rem;">
        <p style="font-size:.85rem;color:#718096;margin:0">
          ${sales.length} sale${sales.length !== 1 ? "s" : ""} for postcode <strong>${escHtml(String(postcode))}</strong>
          — ${formatSaleDate(data.date_from)} to ${formatSaleDate(data.date_to)}
        </p>
        <button onclick="exportSalesToExcel(window._salesData)" style="padding:.3rem .8rem;font-size:.82rem;background:#2e7d32;width:auto;margin:0;">⬇ Export Excel</button>
      </div>
      ${buildTable(
        ["Contract Date","Address","Price","Type","Area","Lot/Plan"],
        sales.map(s => [
          escHtml(formatSaleDate(s.contract_date)),
          escHtml([s.street_number, s.street, s.suburb].filter(Boolean).join(" ") || "—"),
          s.purchase_price != null ? s.purchase_price.toLocaleString("en-AU", {style:"currency",currency:"AUD",maximumFractionDigits:0}) : "—",
          escHtml(s.property_type_desc || s.property_type_category || s.property_type_code || "—"),
          s.area != null ? escHtml(`${Number(s.area).toLocaleString("en-AU")} ${s.area_type || ""}`.trim()) : "—",
          escHtml(s.lot_plan || "—"),
        ])
      )}
    </div>`);
}

function exportSalesToExcel(data) {
  const esc = s => String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const rows = data.sales.map(s => {
    const addr = [s.street_number, s.street, s.suburb].filter(Boolean).join(" ");
    const area = s.area != null ? `${s.area} ${s.area_type || ""}`.trim() : "";
    return `<tr>
      <td>${esc(formatSaleDate(s.contract_date))}</td>
      <td>${esc(addr)}</td>
      <td>${esc(s.purchase_price != null ? s.purchase_price : "")}</td>
      <td>${esc(s.property_type_desc || s.property_type_category || s.property_type_code)}</td>
      <td>${esc(area)}</td>
      <td>${esc(s.lot_plan)}</td>
      <td>${esc(s.postcode)}</td>
      <td>${esc(formatSaleDate(s.settlement_date))}</td>
      <td>${esc(s.valuation_id)}</td>
    </tr>`;
  }).join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"><style>td{mso-number-format:"@";}</style></head>
<body><table>
<thead><tr><th>Contract Date</th><th>Address</th><th>Purchase Price</th><th>Property Type</th><th>Area</th><th>Lot/Plan</th><th>Postcode</th><th>Settlement Date</th><th>Valuation ID</th></tr></thead>
<tbody>${rows}</tbody>
</table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Sales_${data.postcode}_${data.date_from}_${data.date_to}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Transport Tab ─────────────────────────────────────────────────────────────
async function loadTransport() {
  const { lat, lon, address } = state;
  const radius = document.getElementById("transportRadius").value;
  const res = await fetch(`/api/transport?lat=${lat}&lon=${lon}&address=${encodeURIComponent(address)}&radius_m=${radius}`);
  const data = await res.json();
  if (data.error) { setContent("transportContent", `<p class="error">${data.error}</p>`); return; }
  const selectedTypes = new Set([...document.querySelectorAll(".transport-type:checked")].map(c => c.value));
  const stops = (data.stops || []).filter(s => selectedTypes.has(s.type));
  if (!stops.length) { setContent("transportContent", `<p class="empty">No transport stops found within ${radius} m.</p>`); return; }
  setContent("transportContent", `
    <div class="panel-card">
      ${buildTable(["Stop Name","Type","Distance (km)"], stops.map(s => [escHtml(s.name || "—"), escHtml(s.type.replace(/_/g," ")), s.distance_km]))}
    </div>`);
}

// ── Schools Tab ───────────────────────────────────────────────────────────────
async function loadSchools() {
  const { lat, lon, address } = state;
  const radius = document.getElementById("schoolsRadius").value;
  const res = await fetch(`/api/schools?lat=${lat}&lon=${lon}&address=${encodeURIComponent(address)}&radius_m=${radius}`);
  const data = await res.json();
  if (data.error) { setContent("schoolsContent", `<p class="error">${data.error}</p>`); return; }
  const selectedTypes = new Set([...document.querySelectorAll(".school-type:checked")].map(c => c.value));
  const schools = (data.schools || []).filter(s => selectedTypes.has(s.type));
  if (!schools.length) { setContent("schoolsContent", `<p class="empty">No schools found within ${radius} m.</p>`); return; }
  setContent("schoolsContent", `
    <div class="panel-card">
      ${buildTable(["School Name","Type","Distance (km)"], schools.map(s => [escHtml(s.name || "—"), escHtml(s.type.charAt(0).toUpperCase() + s.type.slice(1)), s.distance_km]))}
    </div>`);
}

// ── DA Tab ────────────────────────────────────────────────────────────────────
async function loadDA() {
  const { postcode } = state;
  if (!postcode) { setContent("daContent", `<p class="empty">No postcode available.</p>`); return; }
  const params = new URLSearchParams({ postcode });
  const status = document.getElementById("daStatus")?.value;
  if (status) params.set("status", status);
  const days = document.getElementById("daDays")?.value;
  if (days) params.set("days", days);
  const res = await fetch(`/api/da?${params}`);
  const data = await res.json();
  if (data.error) { setContent("daContent", `<p class="error">${data.error}</p>`); return; }
  const apps = data.applications || [];
  if (!apps.length) { setContent("daContent", `<p class="empty">No development applications found for postcode ${escHtml(postcode)}.</p>`); return; }
  window._daData = data;
  setContent("daContent", `
    <div class="panel-card">
      <div style="display:flex;align-items:center;gap:.8rem;flex-wrap:wrap;margin-bottom:1rem;">
        <p style="font-size:.85rem;color:#718096;margin:0">
          ${apps.length} application${apps.length !== 1 ? "s" : ""} for postcode <strong>${escHtml(postcode)}</strong> — NSW Planning Portal
        </p>
        <button onclick="exportDAToExcel(window._daData)" style="padding:.3rem .8rem;font-size:.82rem;background:#2e7d32;width:auto;margin:0;">⬇ Export Excel</button>
      </div>
      ${buildTable(
        ["App No.","Address","Status","Lodged","Council","Description"],
        apps.map(a => [
          escHtml(a.application_number||"—"),
          escHtml(a.address||"—"),
          escHtml(a.status||"—"),
          escHtml(a.lodgement_date||"—"),
          escHtml(a.council||"—"),
          escHtml(a.description||"—"),
        ])
      )}
    </div>`);
}

// ── Title Search Tab ──────────────────────────────────────────────────────────
const REGISTRY_URLS = {
  NSW: "https://online.nswlrs.com.au/",
  VIC: "https://www.landata.vic.gov.au/",
  QLD: "https://www.titlesqld.com.au/",
  WA:  "https://www0.landgate.wa.gov.au/titlesearch/",
  SA:  "https://www.landservices.com.au/products/title-search",
  ACT: "https://www.accesscanberra.act.gov.au/app/answers/detail/a_id/1285",
  NT:  "https://nt.gov.au/property/land-titles-and-property/search-for-land-title-information",
  TAS: "https://www.thelist.tas.gov.au/",
};

async function loadTitleSearch() {
  const { gnafId, lat, lon } = state;

  // Fetch title search and cadastre data in parallel
  const [titleRes, cadastreRes] = await Promise.all([
    fetch(`/api/title-search?gnaf_id=${encodeURIComponent(gnafId)}`),
    fetch(`/api/cadastre?lat=${lat}&lon=${lon}`),
  ]);

  const data = await titleRes.json();
  if (data.error) { setContent("titleContent", `<p class="error">${escHtml(data.error)}</p>`); return; }

  const cadastre = cadastreRes.ok ? await cadastreRes.json() : null;

  // Fetch land size using lot/plan from cadastre result (best-effort)
  let areaSqm = null;
  if (cadastre && !cadastre.error && cadastre.lot_number && cadastre.plan_label) {
    try {
      const lsRes = await fetch(`/api/landsize?lot=${encodeURIComponent(cadastre.lot_number)}&plan=${encodeURIComponent(cadastre.plan_label)}`);
      if (lsRes.ok) {
        const ls = await lsRes.json();
        if (!ls.error) areaSqm = ls.area_sqm;
      }
    } catch { /* non-blocking */ }
  }

  const st = (data.state || "").toUpperCase();
  const registryUrl = REGISTRY_URLS[st] || null;

  // Use Geoscape cadastral_identifier for the copy button
  const copyId = data.cadastral_identifier || null;
  const displayId = copyId ? `Cadastral ID: <strong>${escHtml(copyId)}</strong>` : "";

  const copyBtn = copyId
    ? `<button class="btn-copy" onclick="copyToClipboard('${escHtml(copyId)}', this)" title="Copy to clipboard">📋 Copy</button>`
    : "";

  const mapBtn = (cadastre && !cadastre.error && cadastre.lot_number && cadastre.plan_label)
    ? `<a href="/api/property-map?lot=${encodeURIComponent(cadastre.lot_number)}&plan=${encodeURIComponent(cadastre.plan_label)}"
         target="_blank" rel="noopener" class="btn-registry" style="background:#2d8a4e;">
        🗺️ View Property Map
       </a>`
    : "";

  const linkHtml = `
    <div class="title-registry-link">
      <div class="title-cad-row">
        ${displayId ? `<span class="title-cad-id">${displayId}</span>${copyBtn}` : ""}
      </div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.5rem;">
        ${mapBtn}
        ${registryUrl ? `<a href="${escHtml(registryUrl)}" target="_blank" rel="noopener" class="btn-registry">
          🔗 Get Title Document (${escHtml(st)} Registry)
        </a>` : ""}
      </div>
    </div>
    ${copyId ? `<p class="title-hint">💡 Click "Copy" then paste into the registry search field.</p>` : ""}`;

  const cadastreRows = cadastre && !cadastre.error ? {
    lotPlanRef:   escHtml(cadastre.lot_id_string || "—"),
    titleStatus:  escHtml(cadastre.title_status  || "—"),
    stratumLevel: cadastre.stratum_level != null ? cadastre.stratum_level : "—",
    hasStratum:   cadastre.has_stratum ? "Yes" : "No",
    cadId:        cadastre.cadid != null ? cadastre.cadid : "—",
  } : {};

  const rows = [
    ["Address",                 escHtml(data.address || "—")],
    ["Cadastral Identifier",    escHtml(data.cadastral_identifier || "—")],
    ["Lot/Plan Ref",            cadastreRows.lotPlanRef   ?? "—"],
    ["Land Size",               areaSqm != null ? `${areaSqm.toLocaleString("en-AU")} m²` : "—"],
    ["Title Status",            cadastreRows.titleStatus  ?? "—"],
    ["Stratum Level",           cadastreRows.stratumLevel ?? "—"],
    ["Has Stratum",             cadastreRows.hasStratum   ?? "—"],
    ["CAD ID",                  cadastreRows.cadId        ?? "—"],
    ["Jurisdiction ID",         escHtml(data.jurisdiction_id || "—")],
    ["Contributor Property ID", escHtml(data.contributor_property_id || "—")],
    ["Geo Feature",             escHtml(data.geo_feature || "—")],
    ["Address Record Type",     escHtml(data.address_record_type || "—")],
    ["Coordinates",             data.lat && data.lon ? `${data.lat}, ${data.lon}` : "—"],
  ];

  setContent("titleContent", `
    <div class="panel-card">
      ${linkHtml}
      <h3 style="margin-bottom:.75rem">📄 Title Record and Spatial Data</h3>
      ${buildTable(["Field", "Value"], rows)}
    </div>`);
}

function renderJson(obj, depth = 0) {
  if (obj === null) return `<span class="json-null">null</span>`;
  if (typeof obj === "boolean") return `<span class="json-bool">${obj}</span>`;
  if (typeof obj === "number") return `<span class="json-num">${obj}</span>`;
  if (typeof obj === "string") return `<span class="json-str">${escHtml(obj)}</span>`;

  if (Array.isArray(obj)) {
    if (!obj.length) return `<span class="json-empty">[ ]</span>`;
    const items = obj.map(v => `<li>${renderJson(v, depth + 1)}</li>`).join("");
    return `<ul class="json-array">${items}</ul>`;
  }

  const entries = Object.entries(obj);
  if (!entries.length) return `<span class="json-empty">{ }</span>`;
  const rows = entries.map(([k, v]) => `
    <tr>
      <td class="json-key">${escHtml(k)}</td>
      <td>${renderJson(v, depth + 1)}</td>
    </tr>`).join("");
  return `<table class="json-table"><tbody>${rows}</tbody></table>`;
}

// ── Bushfire Risk Tab ─────────────────────────────────────────────────────────
async function loadBushfireRisk() {
  const { lat, lon } = state;
  const res = await fetch(`/api/bushfire-risk?lat=${lat}&lon=${lon}`);
  const data = await res.json();
  if (data.error) { setContent("bushfireContent", `<p class="error">${escHtml(data.error)}</p>`); return; }
  const isWarning = data.risk === "WARNING";
  const resultLine = isWarning
    ? "IS within designated Bush Fire Prone Land."
    : "NOT within designated Bush Fire Prone Land.";
  const detailRows = isWarning ? `
    <tr><td class="bf-label">Risk level</td><td class="bf-value" style="color:${data.category === 0 ? "#b45309" : "#c62828"};font-weight:700;">WARNING &nbsp; ${escHtml(data.category_label || "")}</td></tr>
    <tr><td class="bf-label">Category</td><td class="bf-value">${data.category} - ${escHtml(data.category_label || "—")}</td></tr>
    <tr><td class="bf-label">Description</td><td class="bf-value">${escHtml(data.category_label || "—")}</td></tr>
    <tr><td class="bf-label">Guideline</td><td class="bf-value">${escHtml(data.guideline || "—")}</td></tr>
    <tr><td class="bf-label">Last update</td><td class="bf-value">${escHtml(data.last_update || "—")}</td></tr>` : "";
  setContent("bushfireContent", `
    <div class="panel-card">
      <div style="border:2px solid ${isWarning ? "#f5c6c6" : "#b7dfb7"};border-radius:6px;overflow:hidden;font-size:.9rem;">
        <div style="padding:.6rem 1rem;background:${isWarning ? "#c62828" : "#2e7d32"};color:#fff;font-weight:700;letter-spacing:.03em;">
          ${"=".repeat(52)}
        </div>
        <div style="padding:.75rem 1rem;font-weight:700;font-size:.95rem;color:${isWarning ? "#c62828" : "#2e7d32"};">
          RESULT: ${resultLine}
        </div>
        ${isWarning ? `<table style="width:100%;border-collapse:collapse;padding:0 1rem .75rem;">
          <colgroup><col style="width:7rem"></colgroup>
          <tbody>${detailRows}</tbody>
        </table>` : ""}
        <div style="padding:.5rem 1rem;background:${isWarning ? "#fff3f3" : "#f1f8f1"};border-top:2px solid ${isWarning ? "#f5c6c6" : "#b7dfb7"};font-size:.8rem;color:#555;">
          ⚖️ Legal note: This result is indicative only.
        </div>
      </div>
    </div>`);
}

// ── Rental Bond Tab ───────────────────────────────────────────────────────────
async function loadRentalBond() {
  const postcode = state.postcode;
  if (!postcode) { setContent("bondContent", `<p class="empty">No postcode available.</p>`); return; }
  const res = await fetch(`/api/rental-bond-summary?postcode=${encodeURIComponent(postcode)}`);
  const data = await res.json();
  if (data.error) { setContent("bondContent", `<p class="error">${escHtml(data.error)}</p>`); return; }
  const results = data.results || [];
  if (!results.length) { setContent("bondContent", `<p class="empty">No rental bond data found for postcode ${escHtml(String(postcode))}.</p>`); return; }

  // Group by dwelling type
  const groups = {};
  results.forEach(r => {
    const key = r.dwellingtypedesc;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  const sections = Object.entries(groups).map(([typeName, rows]) => {
    const tableRows = rows.map(r => [
      escHtml(r.bedrooms === "0" ? "Studio" : `${r.bedrooms} bed`),
      r.total_count.toLocaleString(),
      `$${Number(r.avg_weeklyrent).toFixed(0)}/wk`,
    ]);
    return `
      <h3 style="margin:1.25rem 0 .75rem">${escHtml(typeName)}</h3>
      ${buildTable(["Bedrooms", "Bond Lodgements", "Avg Weekly Rent"], tableRows)}`;
  }).join("");

  setContent("bondContent", `
    <div class="panel-card">
      <p style="font-size:.85rem;color:#718096;margin-bottom:1rem">
        Rental bond data for postcode <strong>${escHtml(postcode)}</strong> — sourced from NSW Fair Trading bond lodgements.
      </p>
      ${sections}
    </div>`);
}

// ── Bond search (activates bond tab + loads data) ─────────────────────────────
function searchBond() {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.getElementById("bond").classList.add("active");
  document.getElementById("results").hidden = false;
  loadRentalBond();
}

// ── Radius sliders ────────────────────────────────────────────────────────────
document.getElementById("transportRadius").addEventListener("input", function() {
  document.getElementById("transportRadiusLabel").textContent = this.value;
});
document.getElementById("schoolsRadius").addEventListener("input", function() {
  document.getElementById("schoolsRadiusLabel").textContent = this.value;
});

// ── Tab switching ─────────────────────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
    document.getElementById("bondPostcodeInput").value = "";
  });
});

// ── DA Excel Export ───────────────────────────────────────────────────────────
function exportDAToExcel(data) {
  const esc = s => String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const rows = data.applications.map(a => {
    const appNum = a.application_number || "";
    const portalUrl = appNum
      ? `https://www.planningportal.nsw.gov.au/tracking/application/search?applicationNumber=${encodeURIComponent(appNum)}`
      : "";
    const appCell = portalUrl
      ? `<td><a href="${esc(portalUrl)}">${esc(appNum)}</a></td>`
      : `<td>${esc(appNum)}</td>`;
    return `<tr>${appCell}<td>${esc(a.address)}</td><td>${esc(a.status)}</td><td>${esc(a.lodgement_date)}</td><td>${esc(a.council)}</td><td>${esc(a.description)}</td></tr>`;
  }).join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"><style>td{mso-number-format:"@";}</style></head>
<body><table>
<thead><tr><th>App No.</th><th>Address</th><th>Status</th><th>Lodged</th><th>Council</th><th>Description</th></tr></thead>
<tbody>${rows}</tbody>
</table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `DA_${data.postcode}_${new Date().toISOString().slice(0,10)}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setContent(id, html) { document.getElementById(id).innerHTML = html; }

function buildTable(headers, rows) {
  const ths = headers.map(h => `<th>${h}</th>`).join("");
  const trs = rows.map(r =>
    `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`
  ).join("");
  return `<div style="overflow-x:auto"><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = "✅ Copied!";
    setTimeout(() => { btn.textContent = orig; }, 2000);
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

// ── Sales date defaults (last 12 months) ──────────────────────────────────────
(function() {
  const today = new Date();
  const pad = n => String(n).padStart(2, "0");
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const past = new Date(today);
  past.setFullYear(past.getFullYear() - 1);
  document.getElementById("salesDateFrom").value = fmt(past);
  document.getElementById("salesDateTo").value   = fmt(today);
})();
