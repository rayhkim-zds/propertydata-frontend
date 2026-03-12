let state = { lat: null, lon: null, address: null };
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
  document.getElementById("results").hidden = false;

  // Property data (includes geocode)
  const res = await fetch(`/api/property?gnaf_id=${encodeURIComponent(gnafId)}`);
  const data = await res.json();

  if (data.error) { setContent("propertyContent", `<p class="error">${data.error}</p>`); return; }

  const geo = data.geo;
  state = { lat: geo.lat, lon: geo.lon, address: geo.display_name };

  renderAddressHeader(geo);
  renderProperty(data.property, geo);

  // Load remaining tabs in parallel
  loadAI();
  loadTransport();
  loadSchools();
  loadDA();
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
  const stops = data.stops || [];
  if (!stops.length) { setContent("transportContent", `<p class="empty">No transport stops found within ${radius} m.</p>`); return; }
  setContent("transportContent", `
    <div class="panel-card">
      ${buildTable(["Stop Name","Type","Distance (km)"], stops.map(s => [escHtml(s.name), escHtml(s.type), s.distance_km]))}
    </div>`);
}

// ── Schools Tab ───────────────────────────────────────────────────────────────
async function loadSchools() {
  const { lat, lon, address } = state;
  const radius = document.getElementById("schoolsRadius").value;
  const res = await fetch(`/api/schools?lat=${lat}&lon=${lon}&address=${encodeURIComponent(address)}&radius_m=${radius}`);
  const data = await res.json();
  if (data.error) { setContent("schoolsContent", `<p class="error">${data.error}</p>`); return; }
  const schools = data.schools || [];
  if (!schools.length) { setContent("schoolsContent", `<p class="empty">No schools found within ${radius} m.</p>`); return; }
  setContent("schoolsContent", `
    <div class="panel-card">
      ${buildTable(["School Name","Type","Distance (km)"], schools.map(s => [escHtml(s.name), escHtml(s.type), s.distance_km]))}
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

function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
