let state = { lat: null, lon: null, address: null, gnafId: null, postcode: null };
let loadedTabs = new Set();
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
  if (!e.target.closest(".hero__search-wrap")) hideSuggestions();
});

document.getElementById("searchBtn").addEventListener("click", async () => {
  const q = searchInput.value.trim();
  if (q.length < 2) return;
  const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
  if (!res.ok) return;
  const items = await res.json();
  if (!items.length) {
    suggestionList.innerHTML = `<li style="padding:.5rem 1rem;color:#888;pointer-events:none;">No results found</li>`;
    suggestionList.hidden = false;
    return;
  }
  if (items.length === 1) {
    selectAddress(items[0].gnaf_id, items[0].display_name);
  } else {
    suggestionList.innerHTML = "";
    items.forEach(item => {
      const li = document.createElement("li");
      li.textContent = item.display_name;
      li.addEventListener("click", () => selectAddress(item.gnaf_id, item.display_name));
      suggestionList.appendChild(li);
    });
    suggestionList.hidden = false;
  }
});

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("searchBtn").click();
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
  ["aiContent","salesdataContent","transportContent","schoolsContent","shoppingContent","gymsContent",
   "daContent","titleContent","bushfireContent","floodContent","zoningContent","poolContent","bondContent","rentContent","strataContent","catchmentContent","demographicContent"]
    .forEach(id => setContent(id, ""));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelector('.tab-btn[data-tab="property"]').classList.add("active");
  document.getElementById("property").classList.add("active");
  document.getElementById("results").hidden = false;
  document.querySelector(".hero").classList.remove("hero--full");

  // Property data (includes geocode)
  const res = await fetch(`/api/property?gnaf_id=${encodeURIComponent(gnafId)}`);
  const data = await res.json();

  if (data.error) { setContent("propertyContent", `<p class="error">${data.error}</p>`); return; }

  const geo = data.geo;
  state = { lat: geo.lat, lon: geo.lon, address: geo.display_name, gnafId: gnafId, postcode: geo.postcode };

  renderAddressHeader(geo);
  renderProperty(data.property, geo);
  loadedTabs = new Set(["property"]);
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
function renderMarkdown(text) {
  // Process block-level elements split by double newlines
  const blocks = text.split(/\n{2,}/);
  return blocks.map(block => {
    const lines = block.split('\n').map(l => l.trimEnd());

    // Heading: ## or ###
    if (/^#{1,3} /.test(lines[0])) {
      const level = lines[0].match(/^(#{1,3}) /)[1].length;
      const tag = level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5';
      const content = inlineMarkdown(lines[0].replace(/^#{1,3} /, ''));
      return `<${tag} class="ai-heading ai-heading--${level}">${content}</${tag}>`;
    }

    // Bullet list: lines starting with - or *
    if (lines.every(l => /^[-*] /.test(l) || l === '')) {
      const items = lines.filter(l => /^[-*] /.test(l))
        .map(l => `<li>${inlineMarkdown(l.replace(/^[-*] /, ''))}</li>`).join('');
      return `<ul class="ai-list">${items}</ul>`;
    }

    // Mixed block with some bullet lines
    if (lines.some(l => /^[-*] /.test(l))) {
      let html = '';
      let listItems = [];
      for (const l of lines) {
        if (/^[-*] /.test(l)) {
          listItems.push(`<li>${inlineMarkdown(l.replace(/^[-*] /, ''))}</li>`);
        } else {
          if (listItems.length) { html += `<ul class="ai-list">${listItems.join('')}</ul>`; listItems = []; }
          if (l.trim()) html += `<p class="ai-para">${inlineMarkdown(l)}</p>`;
        }
      }
      if (listItems.length) html += `<ul class="ai-list">${listItems.join('')}</ul>`;
      return html;
    }

    // Regular paragraph
    const joined = lines.filter(l => l.trim()).join(' ');
    return joined ? `<p class="ai-para">${inlineMarkdown(joined)}</p>` : '';
  }).filter(Boolean).join('\n');
}

function inlineMarkdown(text) {
  return escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

async function loadAI() {
  const { lat, lon, address } = state;
  const res = await fetch(`/api/ai?lat=${lat}&lon=${lon}&address=${encodeURIComponent(address)}`);
  const data = await res.json();
  if (data.error) { setContent("aiContent", `<p class="error">${data.error}</p>`); return; }
  const html = renderMarkdown(data.summary || "No summary available.");
  setContent("aiContent", `
    <div class="panel-card">
      <h3 class="ai-title">Market Insights</h3>
      <div class="ai-body">${html}</div>
    </div>`);
}

// ── Sales Data Tab ────────────────────────────────────────────────────────────
function formatSaleDate(yyyymmdd) {
  if (!yyyymmdd) return "—";
  const s = String(yyyymmdd);
  // ISO date string: "2024-11-05"
  if (s.length === 10 && s[4] === "-") {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }
  // Legacy integer format: 20241105
  if (s.length === 8) return `${s.slice(6,8)}/${s.slice(4,6)}/${s.slice(0,4)}`;
  return s;
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
const TRANSPORT_ICONS = {
  train:      "🚂 Train",
  metro:      "🚇 Metro",
  light_rail: "🚊 Light Rail",
  bus:        "🚌 Bus",
  coach:      "🚌 Coach",
  ferry:      "⛴️ Ferry",
  school_bus: "🚐 School Bus",
};

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
      ${buildTable(["Stop Name","Type","Distance (km)"], stops.map(s => [escHtml(s.name || "—"), TRANSPORT_ICONS[s.type] || escHtml(s.type), s.distance_km]))}
    </div>`);
}

// ── Shopping Tab ──────────────────────────────────────────────────────────────
const SHOPPING_ICONS = {
  shopping_centre:  "🛍️ Shopping Centre",
  supermarket:      "🛒 Supermarket",
  department_store: "🏬 Department Store",
  retail:           "🏪 Retail",
};

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

// ── Gyms Tab ──────────────────────────────────────────────────────────────────
const GYM_ICONS = {
  gym:           "🏋️ Gym",
  sports_centre: "🏟️ Sports Centre",
};

async function loadGyms() {
  const { lat, lon } = state;
  const radius = document.getElementById("gymsRadius").value;
  const res = await fetch(`/api/gyms?lat=${lat}&lon=${lon}&radius_m=${radius}`);
  const data = await res.json();
  if (data.error) { setContent("gymsContent", `<p class="error">${data.error}</p>`); return; }
  const selectedTypes = new Set([...document.querySelectorAll(".gym-type:checked")].map(c => c.value));
  const venues = (data.venues || []).filter(v => selectedTypes.has(v.type));
  if (!venues.length) { setContent("gymsContent", `<p class="empty">No gyms found within ${radius} m.</p>`); return; }
  setContent("gymsContent", `
    <div class="panel-card">
      ${buildTable(["Venue Name","Type","Distance (km)"], venues.map(v => [escHtml(v.name || "—"), GYM_ICONS[v.type] || escHtml(v.type), v.distance_km]))}
    </div>`);
}

async function loadShopping() {
  const { lat, lon } = state;
  const radius = document.getElementById("shoppingRadius").value;
  const res = await fetch(`/api/shopping?lat=${lat}&lon=${lon}&radius_m=${radius}`);
  const data = await res.json();
  if (data.error) { setContent("shoppingContent", `<p class="error">${data.error}</p>`); return; }
  const selectedTypes = new Set([...document.querySelectorAll(".shopping-type:checked")].map(c => c.value));
  const venues = (data.venues || []).filter(v => selectedTypes.has(v.type));
  if (!venues.length) { setContent("shoppingContent", `<p class="empty">No shopping venues found within ${radius} m.</p>`); return; }
  setContent("shoppingContent", `
    <div class="panel-card">
      ${buildTable(["Venue Name","Type","Distance (km)"], venues.map(v => [escHtml(v.name || "—"), SHOPPING_ICONS[v.type] || escHtml(v.type), v.distance_km]))}
    </div>`);
}

// ── DA Tab ────────────────────────────────────────────────────────────────────
async function loadDA() {
  const { address, postcode } = state;
  if (!postcode) { setContent("daContent", `<p class="empty">No postcode available.</p>`); return; }
  const res = await fetch(`/api/da?address=${encodeURIComponent(address)}&postcode=${encodeURIComponent(postcode)}`);
  const data = await res.json();
  if (data.error) { setContent("daContent", `<p class="error">${escHtml(data.error)}</p>`); return; }

  const council = data.council || "Unknown council";
  const apps = data.applications || [];

  if (!data.has_local_data) {
    const portalLink = data.council_da_url
      ? `<a href="${escHtml(data.council_da_url)}" target="_blank" rel="noopener" class="btn-registry" style="margin-top:.5rem;display:inline-block;">
           🔗 Search ${escHtml(council)} DA Portal ↗
         </a>`
      : "";
    setContent("daContent", `
      <div class="panel-card">
        <p style="margin-bottom:.5rem;">Council: <strong>${escHtml(council)}</strong></p>
        <p style="color:#718096;font-size:.9rem;">Local DA data is not yet available for this council.</p>
        ${portalLink}
      </div>`);
    return;
  }

  if (!apps.length) {
    setContent("daContent", `
      <div class="panel-card">
        <p style="margin-bottom:.5rem;">Council: <strong>${escHtml(council)}</strong></p>
        <p class="empty">No development applications found at this address.</p>
      </div>`);
    return;
  }

  setContent("daContent", `
    <div class="panel-card">
      <p style="font-size:.85rem;color:#718096;margin-bottom:1rem;">
        ${apps.length} application${apps.length !== 1 ? "s" : ""} found at this address — <strong>${escHtml(council)}</strong>
      </p>
      ${buildTable(
        ["App No.", "Type", "Category", "Description", "Lodged", "Status"],
        apps.map(a => {
          const appNum = a.application_number || "—";
          const councilUrl = data.council_da_url;
          const numHtml = councilUrl && appNum !== "—"
            ? `<a href="${escHtml(councilUrl)}" target="_blank" rel="noopener" style="color:#4a7c59;text-decoration:none;border-bottom:1.5px solid #4a7c59;">${escHtml(appNum)}</a>`
            : escHtml(appNum);
          const copyBtn = appNum !== "—"
            ? `<button onclick="copyToClipboard('${escHtml(appNum)}', this)" style="margin-left:.4rem;padding:.1rem .35rem;font-size:.7rem;background:#fff;border:1px solid #4a7c59;border-radius:3px;cursor:pointer;color:#4a7c59;font-weight:600;width:auto;vertical-align:middle;">Copy</button>`
            : "";
          return [
            `${numHtml}${copyBtn}`,
            escHtml(a.application_type || "—"),
            escHtml(a.category || "—"),
            escHtml(a.description || "—"),
            escHtml(a.lodged_date || "—"),
            escHtml((a.status_tags || []).join(", ") || "—"),
          ];
        })
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

// ── Flood Risk Tab ────────────────────────────────────────────────────────────
async function loadFloodRisk() {
  const { lat, lon, address } = state;
  const res = await fetch(`/api/flood-risk?lat=${lat}&lon=${lon}&address=${encodeURIComponent(address)}`);
  const data = await res.json();
  if (data.error) { setContent("floodContent", `<p class="error">${escHtml(data.error)}</p>`); return; }
  const risk = data.is_flood_risk;
  const color = risk === true ? "#b71c1c" : risk === false ? "#2e7d32" : "#888";
  const label = risk === true  ? "IS in a flood risk or flood prone area."
              : risk === false ? "NOT in a flood risk or flood prone area."
              : "Unable to determine flood risk.";
  setContent("floodContent", `
    <div class="panel-card">
      <div style="border:2px solid #e0e0e0;border-radius:6px;overflow:hidden;font-size:.9rem;">
        <div style="padding:.6rem 1rem;background:${color};color:#fff;font-weight:700;letter-spacing:.03em;">
          Flood Risk
        </div>
        <div style="padding:.75rem 1rem;font-weight:700;font-size:.95rem;color:${color};">
          RESULT: ${label}
        </div>
        ${data.summary ? `<div style="padding:.5rem 1rem;color:#333;font-size:.875rem;">${escHtml(data.summary)}</div>` : ""}
        <div style="padding:.5rem 1rem;background:#f8f8f8;border-top:2px solid #e0e0e0;font-size:.8rem;color:#555;">
          ⚠️ AI-based assessment — verify with your council or the NSW SES.
        </div>
      </div>
    </div>`);
}

// ── Zoning Tab ────────────────────────────────────────────────────────────────
const LGA_WEBSITES = {
  "SYDNEY": "https://www.cityofsydney.nsw.gov.au",
  "CITY OF SYDNEY": "https://www.cityofsydney.nsw.gov.au",
  "INNER WEST": "https://www.innerwest.nsw.gov.au",
  "NORTHERN BEACHES": "https://www.northernbeaches.nsw.gov.au",
  "WAVERLEY": "https://www.waverley.nsw.gov.au",
  "WOOLLAHRA": "https://www.woollahra.nsw.gov.au",
  "RANDWICK": "https://www.randwick.nsw.gov.au",
  "PENRITH": "https://www.penrithcity.nsw.gov.au",
  "PARRAMATTA": "https://www.cityofparramatta.nsw.gov.au",
  "CITY OF PARRAMATTA": "https://www.cityofparramatta.nsw.gov.au",
  "BLACKTOWN": "https://www.blacktown.nsw.gov.au",
  "LIVERPOOL": "https://www.liverpool.nsw.gov.au",
  "CANTERBURY-BANKSTOWN": "https://www.cbcity.nsw.gov.au",
  "NORTH SYDNEY": "https://www.northsydney.nsw.gov.au",
  "KU-RING-GAI": "https://www.krg.nsw.gov.au",
  "WILLOUGHBY": "https://www.willoughby.nsw.gov.au",
  "LANE COVE": "https://www.lanecove.nsw.gov.au",
  "RYDE": "https://www.ryde.nsw.gov.au",
  "HORNSBY": "https://www.hornsby.nsw.gov.au",
  "CANADA BAY": "https://www.canadabay.nsw.gov.au",
  "BLUE MOUNTAINS": "https://www.bmcc.nsw.gov.au",
  "WOLLONGONG": "https://www.wollongong.nsw.gov.au",
  "NEWCASTLE": "https://www.newcastle.nsw.gov.au",
};

async function loadZoning() {
  const { lat, lon } = state;
  let data;
  try {
    const res = await fetch(`/api/zoning?lat=${lat}&lon=${lon}`);
    data = await res.json();
  } catch (e) {
    setContent("zoningContent", `<p class="error">Failed to load zoning data: ${escHtml(String(e))}</p>`);
    return;
  }
  if (data.error) { setContent("zoningContent", `<p class="error">${escHtml(data.error)}</p>`); return; }
  if (data.detail) { setContent("zoningContent", `<p class="error">${escHtml(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail))}</p>`); return; }
  const lgaKey = (data.lga_name || "").toUpperCase();
  const lgaUrl = LGA_WEBSITES[lgaKey];
  const lgaDisplay = lgaUrl
    ? `<a href="${lgaUrl}" target="_blank" rel="noopener" style="color:#2b6cb0;">${escHtml(data.lga_name)}</a>`
    : escHtml(data.lga_name || "—");
  setContent("zoningContent", `
    <div class="panel-card">
      <div style="border:2px solid #bee3f8;border-radius:6px;overflow:hidden;font-size:.9rem;">
        <div style="padding:.6rem 1rem;background:#2b6cb0;color:#fff;font-weight:700;letter-spacing:.03em;">
          Land Zoning
        </div>
        <table style="width:100%;border-collapse:collapse;padding:0 1rem .75rem;">
          <colgroup><col style="width:9rem"></colgroup>
          <tbody>
            <tr><td class="bf-label">Zone Code</td><td class="bf-value" style="font-weight:700;">${escHtml(data.zone_code || "—")}</td></tr>
            <tr><td class="bf-label">Zone Name</td><td class="bf-value">${escHtml(data.zone_name || "—")}</td></tr>
            <tr><td class="bf-label">LEP / EPI</td><td class="bf-value">${escHtml(data.epi_name || "—")}</td></tr>
            <tr><td class="bf-label">LGA</td><td class="bf-value">${lgaDisplay}</td></tr>
            <tr><td class="bf-label">Type</td><td class="bf-value">${escHtml(data.epi_type || "—")}</td></tr>
          </tbody>
        </table>
        <div style="padding:.5rem 1rem;background:#ebf8ff;border-top:2px solid #bee3f8;font-size:.8rem;color:#555;">
          ⚖️ Source: NSW Planning Portal. For planning advice consult your council.
        </div>
      </div>
    </div>`);
}

// ── Sydney Water Tab ──────────────────────────────────────────────────────────
async function loadWater() {
  const { lat, lon, address } = state;
  const catchmentUrl = "https://www.sydneywater.com.au/water-the-environment/how-we-manage-sydneys-water/stormwater-network/stormwater-catchment-map.html";
  const params = new URLSearchParams({ lat, lon, address });
  const safeAddress = escHtml(address);
  setContent("waterContent", `
    <div class="panel-card">
      <div style="border:1px solid #b3d4f5;border-radius:6px;overflow:hidden;">
        <div style="padding:.6rem 1rem;background:#0057a8;color:#fff;font-weight:700;font-size:.9rem;display:flex;align-items:center;gap:.75rem;">
          <span style="flex:1;">💧 Sydney Water</span>
          <button
            onclick="navigator.clipboard.writeText('${safeAddress}').then(()=>{this.textContent='Address copied!';setTimeout(()=>this.textContent='Check Stormwater Catchment ↗',2000)});window.open('${catchmentUrl}','_blank')"
            style="margin:0;width:auto;padding:.3rem .8rem;font-size:.8rem;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);border-radius:4px;color:#fff;cursor:pointer;white-space:nowrap;">
            Check Stormwater Catchment ↗
          </button>
        </div>
        <div style="padding:.5rem 1rem;background:#e8f2fc;font-size:.78rem;color:#444;border-bottom:1px solid #b3d4f5;">
          Clicking "Check Stormwater Catchment" opens the Sydney Water map and copies the address to your clipboard — paste it into the search box on that page.
        </div>
        <iframe
          src="/api/water-map?${params}"
          style="width:100%;height:500px;border:none;display:block;"
          title="Sydney Water Map"
          loading="lazy"
        ></iframe>
      </div>
    </div>`);
}

// ── Strata Tab ────────────────────────────────────────────────────────────────
async function loadStrata() {
  const { lat, lon, address } = state;

  const res = await fetch(`/api/strata-simple?lat=${lat}&lon=${lon}&address=${encodeURIComponent(address)}`);
  const data = await res.json();
  if (data.error) { setContent("strataContent", `<p class="error">${escHtml(data.error)}</p>`); return; }

  if (!data.is_strata) {
    setContent("strataContent", `
      <div class="panel-card">
        <div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;font-size:.9rem;">
          <div style="padding:.6rem 1rem;background:#718096;color:#fff;font-weight:700;">Strata Plan</div>
          <div style="padding:.75rem 1rem;color:#555;">This property is <strong>not a strata title</strong> property.</div>
        </div>
      </div>`);
    return;
  }

  setContent("strataContent", `
    <div class="panel-card">
      <div style="border:2px solid #bee3f8;border-radius:6px;overflow:hidden;font-size:.9rem;">
        <div style="padding:.6rem 1rem;background:#2b6cb0;color:#fff;font-weight:700;letter-spacing:.03em;">Strata Plan</div>
        <div style="padding:.75rem 1rem;display:flex;align-items:center;gap:.75rem;">
          <span style="font-size:1.15rem;font-weight:700;color:#2b6cb0;">${escHtml(data.strata_plan_number)}</span>
          <button class="btn-copy" onclick="copyToClipboard('${escHtml(data.strata_plan_number)}', this)" title="Copy strata plan number">📋 Copy</button>
        </div>
        <div style="padding:.5rem 1rem .75rem;">
          <a href="${escHtml(data.strata_search_url)}" target="_blank" rel="noopener"
             style="display:inline-block;background:#2b6cb0;color:#fff;padding:.4rem 1rem;border-radius:4px;font-size:.875rem;text-decoration:none;font-weight:600;">
            Search NSW Strata Register ↗
          </a>
        </div>
      </div>
    </div>`);
}

// ── Pool Tab ──────────────────────────────────────────────────────────────────
async function loadPool() {
  const { lat, lon, address } = state;
  const res = await fetch(`/api/pool-detect?lat=${lat}&lon=${lon}&address=${encodeURIComponent(address)}`);
  const data = await res.json();
  if (data.error) { setContent("poolContent", `<p class="error">${escHtml(data.error)}</p>`); return; }

  const hasPool = data.has_pool;
  const color = hasPool === true ? "#2e7d32" : hasPool === false ? "#555" : "#888";
  const label = hasPool === true ? "Yes — pool detected"
              : hasPool === false ? "No pool detected"
              : "Unable to determine";

  setContent("poolContent", `
    <div class="panel-card">
      <div style="border:2px solid #e0e0e0;border-radius:6px;overflow:hidden;font-size:.9rem;">
        <div style="padding:.6rem 1rem;background:${color};color:#fff;font-weight:700;">Swimming Pool Detection</div>
        <div style="padding:.75rem 1rem;font-weight:700;font-size:.95rem;color:${color};">${escHtml(label)}</div>
        ${hasPool === true ? `
        <div style="padding:.5rem 1rem .75rem;">
          <a href="${escHtml(data.register_url)}" target="_blank" rel="noopener"
             style="display:inline-block;background:#0070f3;color:#fff;padding:.4rem 1rem;border-radius:4px;font-size:.875rem;text-decoration:none;font-weight:600;">
            Check NSW Swimming Pool Register ↗
          </a>
        </div>` : ""}
        <div style="padding:.5rem 1rem;background:#f8f8f8;border-top:1px solid #e0e0e0;font-size:.8rem;color:#555;">
          ⚠️ AI-based detection — verify with the NSW Swimming Pool Register.
        </div>
      </div>
    </div>`);
}

// ── Rent Tab ──────────────────────────────────────────────────────────────────
async function loadRent() {
  const { lat, lon, address } = state;
  const res = await fetch(`/api/rent-detect?lat=${lat}&lon=${lon}&address=${encodeURIComponent(address)}`);
  const data = await res.json();
  if (data.error) { setContent("rentContent", `<p class="error">${escHtml(data.error)}</p>`); return; }

  if (data.is_rented === false) {
    setContent("rentContent", `
      <div class="panel-card">
        <div style="border:2px solid #e0e0e0;border-radius:6px;overflow:hidden;font-size:.9rem;">
          <div style="padding:.6rem 1rem;background:#555;color:#fff;font-weight:700;">Rental Listing</div>
          <div style="padding:.75rem 1rem;color:#555;font-weight:700;">No current rental listing found for this property.</div>
          <div style="padding:.5rem 1rem;background:#f8f8f8;border-top:1px solid #e0e0e0;font-size:.8rem;color:#555;">
            ⚠️ AI-based search — listing may have been recently added or removed.
          </div>
        </div>
      </div>`);
    return;
  }

  if (data.is_rented === null) {
    setContent("rentContent", `<p class="empty">Unable to determine rental status for this property.</p>`);
    return;
  }

  const rows = [
    ["Weekly Rent",    data.weekly_rent],
    ["Bedrooms",       data.bedrooms],
    ["Property Type",  data.property_type],
    ["Source",         data.source],
  ].filter(([, v]) => v).map(([label, val]) => `
    <tr>
      <td style="padding:.4rem .8rem;color:#666;white-space:nowrap;font-weight:500;">${escHtml(label)}</td>
      <td style="padding:.4rem .8rem;font-weight:700;color:#1a202c;">${escHtml(val)}</td>
    </tr>`).join("");

  const listingBtn = data.listing_url
    ? `<div style="padding:.5rem 1rem .75rem;">
        <a href="${escHtml(data.listing_url)}" target="_blank" rel="noopener"
           style="display:inline-block;background:#0070f3;color:#fff;padding:.4rem 1rem;border-radius:4px;font-size:.875rem;text-decoration:none;font-weight:600;">
          View Listing ↗
        </a>
      </div>` : "";

  setContent("rentContent", `
    <div class="panel-card">
      <div style="border:2px solid #b7dfb7;border-radius:6px;overflow:hidden;font-size:.9rem;">
        <div style="padding:.6rem 1rem;background:#2e7d32;color:#fff;font-weight:700;">Rental Listing</div>
        <div style="padding:.75rem 1rem;font-weight:700;font-size:.95rem;color:#2e7d32;">Currently listed for rent</div>
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
        ${listingBtn}
        <div style="padding:.5rem 1rem;background:#f1f8f1;border-top:1px solid #b7dfb7;font-size:.8rem;color:#555;">
          ⚠️ AI-based search — verify on the listing site.
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


// ── Radius sliders ────────────────────────────────────────────────────────────
document.getElementById("transportRadius").addEventListener("input", function() {
  document.getElementById("transportRadiusLabel").textContent = this.value;
});
document.getElementById("schoolsRadius").addEventListener("input", function() {
  document.getElementById("schoolsRadiusLabel").textContent = this.value;
});
document.getElementById("shoppingRadius").addEventListener("input", function() {
  document.getElementById("shoppingRadiusLabel").textContent = this.value;
});
document.getElementById("gymsRadius").addEventListener("input", function() {
  document.getElementById("gymsRadiusLabel").textContent = this.value;
});

// ── School Catchment Tab ──────────────────────────────────────────────────────
async function loadCatchment() {
  const { lat, lon } = state;
  const res = await fetch(`/api/school-catchment?lat=${lat}&lon=${lon}`);
  const data = await res.json();
  if (data.error) { setContent("catchmentContent", `<p class="error">${escHtml(data.error)}</p>`); return; }
  const catchments = data.catchments || [];
  if (!catchments.length) {
    setContent("catchmentContent", `<p class="empty">No NSW public school catchment found for this location.</p>`);
    return;
  }
  const TYPE_COLOR = { primary: "#2b6cb0", secondary: "#6b46c1" };
  const TYPE_BG    = { primary: "#ebf8ff", secondary: "#faf5ff" };
  const rows = catchments.map(c => {
    const color = TYPE_COLOR[c.school_type] || "#555";
    const bg    = TYPE_BG[c.school_type]    || "#f7f7f7";
    const label = c.school_type === "primary" ? "Primary" : "Secondary";
    const meta  = [c.catch_type, c.priority ? `Priority ${c.priority}` : null].filter(Boolean).join(" · ");
    return `<tr>
      <td style="padding:.45rem 1rem;">
        <span style="display:inline-block;padding:.15rem .55rem;border-radius:99px;font-size:.75rem;font-weight:700;background:${bg};color:${color};">${label}</span>
      </td>
      <td style="padding:.45rem .5rem;font-weight:600;color:#1a1a1a;">${escHtml(c.school_name)}</td>
      <td style="padding:.45rem 1rem;color:#666;font-size:.85rem;">${escHtml(meta)}</td>
    </tr>`;
  }).join("");
  setContent("catchmentContent", `
    <div class="panel-card">
      <div style="border:1px solid #d0d7ff;border-radius:6px;overflow:hidden;font-size:.9rem;">
        <div style="padding:.6rem 1rem;background:#3949ab;color:#fff;font-weight:700;">School Catchment Areas</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f0f2ff;text-align:left;font-size:.8rem;color:#555;">
              <th style="padding:.35rem 1rem;font-weight:600;">Type</th>
              <th style="padding:.35rem .5rem;font-weight:600;">School</th>
              <th style="padding:.35rem 1rem;font-weight:600;">Catchment</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="padding:.5rem 1rem;background:#f5f6ff;border-top:1px solid #d0d7ff;font-size:.78rem;color:#666;">
          NSW public schools only &mdash; data via NSW Department of Education.
        </div>
      </div>
    </div>`);
}

// ── Demographics Tab ──────────────────────────────────────────────────────────
async function loadDemographic() {
  const { postcode } = state;
  if (!postcode) { setContent("demographicContent", `<p class="empty">No postcode available for this address.</p>`); return; }
  const res = await fetch(`/api/demographic?postcode=${encodeURIComponent(postcode)}`);
  const d = await res.json();
  if (d.error) { setContent("demographicContent", `<p class="error">${escHtml(d.error)}</p>`); return; }

  const fmt = v => v != null ? Number(v).toLocaleString("en-AU") : "—";
  const fmtCurr = v => v != null ? `$${Number(v).toLocaleString("en-AU")}` : "—";
  const tot = d.total_population || 0;
  const pct = v => tot && v != null ? `${(v / tot * 100).toFixed(1)}% <span style="color:#a0aec0;font-weight:400;font-size:.82em">(${fmt(v)})</span>` : fmt(v);

  const ageRows = [
    ["0–4",   d.age_distribution.age_0_4],
    ["5–14",  d.age_distribution.age_5_14],
    ["15–19", d.age_distribution.age_15_19],
    ["20–24", d.age_distribution.age_20_24],
    ["25–34", d.age_distribution.age_25_34],
    ["35–44", d.age_distribution.age_35_44],
    ["45–54", d.age_distribution.age_45_54],
    ["55–64", d.age_distribution.age_55_64],
    ["65–74", d.age_distribution.age_65_74],
    ["75–84", d.age_distribution.age_75_84],
    ["85+",   d.age_distribution.age_85_plus],
  ].map(([label, val]) => [escHtml(label), pct(val)]);

  setContent("demographicContent", `
    <div class="panel-card">
      <p style="font-size:.85rem;color:#718096;margin-bottom:1rem">
        ABS 2021 Census data for postcode <strong>${escHtml(postcode)}</strong>
      </p>

      <div style="border:1px solid #bee3f8;border-radius:6px;overflow:hidden;margin-bottom:1rem;">
        <div style="padding:.6rem 1rem;background:#2b6cb0;color:#fff;font-weight:700;">👥 Population</div>
        ${buildTable(["Metric", "Value"], [
          ["Total population", fmt(d.total_population)],
          ["Median age", d.median_age != null ? String(d.median_age) : "—"],
        ])}
      </div>

      <div style="border:1px solid #c6f6d5;border-radius:6px;overflow:hidden;margin-bottom:1rem;">
        <div style="padding:.6rem 1rem;background:#276749;color:#fff;font-weight:700;">💰 Income &amp; Housing Medians</div>
        ${buildTable(["Metric", "Value"], [
          ["Personal income (weekly)",      fmtCurr(d.median_personal_income_weekly)],
          ["Household income (weekly)",     fmtCurr(d.median_household_income_weekly)],
          ["Family income (weekly)",        fmtCurr(d.median_family_income_weekly)],
          ["Mortgage repayment (monthly)",  fmtCurr(d.median_mortgage_monthly)],
          ["Rent (weekly)",                 fmtCurr(d.median_rent_weekly)],
          ["Avg household size",            d.avg_household_size != null ? String(d.avg_household_size) : "—"],
          ["Avg persons per bedroom",       d.avg_persons_per_bedroom != null ? String(d.avg_persons_per_bedroom) : "—"],
        ])}
      </div>

      <div style="border:1px solid #feebc8;border-radius:6px;overflow:hidden;margin-bottom:1rem;">
        <div style="padding:.6rem 1rem;background:#744210;color:#fff;font-weight:700;">🌏 Background &amp; Language</div>
        ${buildTable(["Metric", "Persons"], [
          ["Born in Australia",       pct(d.born_australia)],
          ["Born overseas",           pct(d.born_overseas)],
          ["English only at home",    pct(d.english_only_home)],
          ["Other language at home",  pct(d.other_lang_home)],
          ["Australian citizens",     pct(d.australian_citizen)],
          ["Indigenous persons",      pct(d.indigenous_total)],
        ])}
      </div>

      <div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:1rem;">
        <div style="padding:.6rem 1rem;background:#4a5568;color:#fff;font-weight:700;">📊 Age Distribution</div>
        ${buildTable(["Age Group", "Persons"], ageRows)}
      </div>

      <p style="font-size:.75rem;color:#a0aec0;">
        Source: ABS 2021 Census of Population and Housing — Postcode Area (POA) &nbsp;|&nbsp;
        <a id="census-pdf-link" href="#" target="_blank" rel="noopener noreferrer"
           style="color:#2b6cb0;text-decoration:none;"
           onclick="openCensusProfile(event, '${escHtml(postcode)}')">📄 View POA${escHtml(postcode)} Census Profile (PDF)</a>
      </p>
    </div>`);
}

async function openCensusProfile(event, postcode) {
  event.preventDefault();
  const link = event.currentTarget;
  link.textContent = "⏳ Loading…";
  try {
    const res = await fetch(`/api/census-profile-url?postcode=${encodeURIComponent(postcode)}`);
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || data.detail || "Could not retrieve census profile.");
      link.innerHTML = `📄 View POA${postcode} Census Profile (PDF)`;
      return;
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
  } catch {
    alert("Network error. Please try again.");
  }
  link.innerHTML = `📄 View POA${postcode} Census Profile (PDF)`;
}

// ── Tab switching ─────────────────────────────────────────────────────────────
const TAB_LOADERS = {
  ai:        loadAI,
  salesdata: loadSalesData,
  transport: loadTransport,
  schools:   loadSchools,
  shopping:  loadShopping,
  gyms:      loadGyms,
  da:        loadDA,
  title:     loadTitleSearch,
  bushfire:  loadBushfireRisk,
  flood:     loadFloodRisk,
  zoning:    loadZoning,
  pool:      loadPool,
  bond:      loadRentalBond,
  rent:      loadRent,
  strata:    loadStrata,
  water:       loadWater,
  catchment:   loadCatchment,
  demographic: loadDemographic,
};

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById(tab).classList.add("active");
    if (state.lat && !loadedTabs.has(tab) && TAB_LOADERS[tab]) {
      setContent(tab + "Content", `<p class="loading">Loading…</p>`);
      loadedTabs.add(tab);
      TAB_LOADERS[tab]();
    }
  });
});


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

// ── User-type tabs ────────────────────────────────────────────────────────────
document.querySelectorAll(".user-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".user-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
  });
});

// ── Mini Mortgage Calculator Widget ──────────────────────────────────────────
async function calcMiniMortgage() {
  const pv       = parseFloat(document.getElementById("mcwPropertyValue").value);
  const dep      = parseFloat(document.getElementById("mcwDeposit").value);
  const rate     = parseFloat(document.getElementById("mcwRate").value);
  const selectedState = document.getElementById("mcwState").value;
  const term     = parseInt(document.getElementById("mcwTerm").value);
  const loanType = document.getElementById("mcwLoanType").value;

  const resultEl = document.getElementById("mcwResult");
  const errEl    = document.getElementById("mcwError");
  const btn      = document.querySelector(".mini-calc__btn");

  resultEl.hidden = true;
  errEl.hidden    = true;

  if (!pv || !dep || !rate) {
    errEl.textContent = "Please fill in all fields.";
    errEl.hidden = false;
    return;
  }

  btn.textContent = "Calculating…";
  btn.disabled    = true;

  try {
    const res  = await fetch("/api/mortgage-quote", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        property_value:     pv,
        deposit:            dep,
        annual_rate_pct:    rate,
        state:              selectedState,
        loan_term_years:    term,
        loan_type:          loanType,
        frequency:          "monthly",
        offset_balance:     0,
        annual_fee:         0,
        upfront_fee:        0,
        is_first_home_buyer: false,
        is_new_home:        false,
        is_investment:      false,
      }),
    });

    const data = await res.json();

    if (data.error) {
      errEl.textContent = data.error;
      errEl.hidden = false;
      return;
    }

    const repayment = data.repayments && data.repayments.repayment;
    const lvr       = data.loan_details && data.loan_details.lvr_pct != null
      ? data.loan_details.lvr_pct.toFixed(1) + "% LVR"
      : "";

    resultEl.innerHTML =
      `<div class="mini-calc__result__label">Monthly Repayment</div>` +
      `<div class="mini-calc__result__value">${repayment != null ? "$" + Math.round(repayment).toLocaleString("en-AU") : "—"}</div>` +
      (lvr ? `<div class="mini-calc__result__sub">${lvr}</div>` : "");
    resultEl.hidden = false;

  } catch (e) {
    errEl.textContent = "Could not calculate — please try again.";
    errEl.hidden = false;
  } finally {
    btn.textContent = "Calculate";
    btn.disabled    = false;
  }
}
