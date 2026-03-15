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

  setContent("propertyContent", `<p class="loading">Loading…</p>`);
  setContent("aiContent",       `<p class="loading">Loading…</p>`);
  setContent("transportContent",`<p class="loading">Loading…</p>`);
  setContent("schoolsContent",  `<p class="loading">Loading…</p>`);
  setContent("daContent",       `<p class="loading">Loading…</p>`);
  setContent("titleContent",    `<p class="loading">Loading…</p>`);
  setContent("bondContent",     `<p class="loading">Loading…</p>`);
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
  loadTransport();
  loadSchools();
  loadDA();
  loadTitleSearch();
  loadRentalBond();
}

// ── Address Header ────────────────────────────────────────────────────────────
function renderAddressHeader(geo) {
  document.getElementById("addressHeader").innerHTML = `
    <h2>📍 ${geo.display_name}</h2>
    <div class="metrics">
      <div class="metric"><div class="label">Suburb</div><div class="value">${geo.suburb}</div></div>
      <div class="metric"><div class="label">Postcode</div><div class="value">${geo.postcode}</div></div>
      <div class="metric"><div class="label">State</div><div class="value">${geo.state}</div></div>
      <div class="metric"><div class="label">Lat</div><div class="value">${geo.lat.toFixed(5)}</div></div>
      <div class="metric"><div class="label">Lon</div><div class="value">${geo.lon.toFixed(5)}</div></div>
    </div>`;
}

// ── Property Tab ──────────────────────────────────────────────────────────────
function renderProperty(prop, geo) {
  const price = prop && !prop.error && typeof prop.median_price === "number"
    ? `$${prop.median_price.toLocaleString()}`
    : "N/A";
  setContent("propertyContent", `
    <div class="panel-card">
      <div class="metrics" style="margin-bottom:1.25rem">
        <div class="metric"><div class="label">Median Price</div><div class="value">${price}</div></div>
        <div class="metric"><div class="label">Suburb</div><div class="value">${geo.suburb}</div></div>
        <div class="metric"><div class="label">State</div><div class="value">${geo.state}</div></div>
      </div>
      <p style="font-size:.85rem;color:#718096;margin-top:.5rem">
        Coordinates: ${geo.lat}, ${geo.lon}
      </p>
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
      <h3 style="margin-bottom:1rem">AI Property & Suburb Summary</h3>
      <p class="ai-summary">${escHtml(data.summary || "No summary available.")}</p>
    </div>`);
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
  const { lat, lon, address } = state;
  const radius = document.getElementById("daRadius").value;
  const res = await fetch(`/api/da?lat=${lat}&lon=${lon}&address=${encodeURIComponent(address)}&radius_m=${radius}`);
  const data = await res.json();
  if (data.error) { setContent("daContent", `<p class="error">${data.error}</p>`); return; }
  const apps = data.applications || [];
  if (!apps.length) { setContent("daContent", `<p class="empty">No development applications found within ${radius} m.</p>`); return; }
  setContent("daContent", `
    <div class="panel-card">
      ${buildTable(
        ["Address","Description","Council","Date Received","Distance (km)","Link"],
        apps.map(a => [
          escHtml(a.address||""), escHtml(a.description||""), escHtml(a.authority||""),
          escHtml(a.date_received||""), a.distance_km,
          a.info_url ? `<a href="${escHtml(a.info_url)}" target="_blank">View</a>` : "",
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

// ── Rental Bond Tab ───────────────────────────────────────────────────────────
async function loadRentalBond() {
  const { postcode } = state;
  if (!postcode) { setContent("bondContent", `<p class="empty">No postcode available.</p>`); return; }
  const res = await fetch(`/api/rental-bond-summary?postcode=${encodeURIComponent(postcode)}`);
  const data = await res.json();
  if (data.error) { setContent("bondContent", `<p class="error">${escHtml(data.error)}</p>`); return; }
  const results = data.results || [];
  if (!results.length) { setContent("bondContent", `<p class="empty">No rental bond data found for postcode ${escHtml(postcode)}.</p>`); return; }

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
document.getElementById("daRadius").addEventListener("input", function() {
  document.getElementById("daRadiusLabel").textContent = this.value;
});

// ── Tab switching ─────────────────────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
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
