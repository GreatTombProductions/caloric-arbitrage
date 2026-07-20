/**
 * Caloric Arbitrage — Frontend
 * Vanilla JS + MapLibre GL + PMTiles
 *
 * Two views:
 *   - Portland (Local Proxy): H3-res-8 hex grid with surplus/deficit/arbitrage
 *   - Global Historical: Country choropleth with temporal animation
 *
 * No framework, no build step. Serves from any static server.
 */

// ── PMTiles protocol registration ───────────────────────────────────────────
const protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

// ── Paths ────────────────────────────────────────────────────────────────────
// Resolve paths relative to the Pages root without discarding a repository
// prefix. These exact bytes work at both localhost / and /caloric-arbitrage/.
function resolvePath(rel) {
  return new URL(rel, window.location.href).pathname;
}
const PORTLAND_PMTILES = resolvePath("./tiles/caloric_arbitrage.pmtiles");
const GLOBAL_TILES_DIR = resolvePath("./data/global-temporal/tiles/");
const PORTLAND_CENTER = [-122.67, 45.52];
const PORTLAND_ZOOM = 11.5;
const GLOBAL_MISSING_COLOR = "#737373";

// ── State ────────────────────────────────────────────────────────────────────
let activeView = "portland";
let activePortlandLayer = "arbitrage";
let activeGlobalMeasure = "global_loss_annual";

// Temporal state
let currentPeriodIdx = 0;
let isPlaying = false;
let playTimer = null;
let periodsForMeasure = {};   // { measureId: [period_labels...] }

// ── Measure Definitions ──────────────────────────────────────────────────────

const MEASURES = {
  global_loss_annual: {
    id: "global_loss_annual",
    label: "Caloric Loss",
    detail: "Annual, country-level, FAO",
    pmtiles: GLOBAL_TILES_DIR + "global_loss_annual.pmtiles",
    indicatorCode: "21059",
    indicatorName: "Incidence of caloric losses at retail distribution level",
    unit: "%",
    sourceId: "faostat_fs",
    publisher: "Food and Agriculture Organization of the United Nations, Statistics Division, Food Security and Nutrition Statistics Team",
    datasetName: "FAOSTAT Suite of Food Security Indicators",
    sourceName: "FAOSTAT Suite of Food Security Indicators",
    sourceUrl: "https://www.fao.org/faostat/en/#data/FS",
    edition: "2026-04-29 (edition year 2026)",
    accessDate: "19 July 2026",
    license: "CC BY 4.0 unless dataset metadata identifies a third-party exception",
    termsUrl: "https://www.fao.org/contact-us/terms/db-terms-of-use/en/",
    methodologyUrl: "https://www.fao.org/4/i3434e/i3434e.pdf",
    notices: "Open non-commercial visualization. Attribution does not imply FAO endorsement.",
    provenanceClass: "modeled_estimate",
    nativeResolution: "Country (annual)",
    // Periods: list of period_label values
    periods: Array.from({length: 25}, (_, i) => String(2000 + i)),
    // Color: warm reds (surplus/loss)
    colorStops: [
      [0, "#f7f7f7"], [1, "#fddbc7"], [2, "#f4a582"],
      [3, "#d6604d"], [4, "#b2182b"], [5, "#67001f"],
    ],
    legendTitle: "Caloric Loss (% of production)",
    legendLabels: ["0%", "1%", "2%", "3%", "4%", "6%+"],
    legendColors: ["#f7f7f7", "#fddbc7", "#f4a582", "#d6604d", "#b2182b", "#67001f"],
    limitations: "Country-level modeled estimates. FAO aggregates (regional/world) excluded where possible. Values are incidence of caloric losses at retail distribution level — not directly measured surplus. Not suitable for subnational or daily inference.",
  },

  global_undernourishment_3yr: {
    id: "global_undernourishment_3yr",
    label: "Undernourishment",
    detail: "3-year average, country-level, FAO",
    pmtiles: GLOBAL_TILES_DIR + "global_undernourishment_3yr.pmtiles",
    indicatorCode: "210041",
    indicatorName: "Prevalence of undernourishment (3-year average)",
    unit: "%",
    sourceId: "faostat_fs",
    publisher: "Food and Agriculture Organization of the United Nations, Statistics Division, Food Security and Nutrition Statistics Team",
    datasetName: "FAOSTAT Suite of Food Security Indicators",
    sourceName: "FAOSTAT Suite of Food Security Indicators",
    sourceUrl: "https://www.fao.org/faostat/en/#data/FS",
    edition: "2026-04-29 (edition year 2026)",
    accessDate: "19 July 2026",
    license: "CC BY 4.0 unless dataset metadata identifies a third-party exception",
    termsUrl: "https://www.fao.org/contact-us/terms/db-terms-of-use/en/",
    methodologyUrl: "https://www.fao.org/4/i3434e/i3434e.pdf",
    notices: "Open non-commercial visualization. Attribution does not imply FAO endorsement.",
    provenanceClass: "modeled_estimate",
    nativeResolution: "Country (3-year periods)",
    periods: Array.from({length: 23}, (_, i) => `${2000 + i}-${2002 + i}`),
    // Color: cool blues (deficit)
    colorStops: [
      [0, "#f7f7f7"], [5, "#d1e5f0"], [15, "#92c5de"],
      [25, "#4393c3"], [35, "#2166ac"], [50, "#053061"],
    ],
    legendTitle: "Undernourishment (% of population)",
    legendLabels: ["0%", "5%", "15%", "25%", "35%", "50%+"],
    legendColors: ["#f7f7f7", "#d1e5f0", "#92c5de", "#4393c3", "#2166ac", "#053061"],
    limitations: "3-year modeled averages. Country-level only. Geometry-mapped missing periods remain visible in gray as No data; no numeric value is invented. Some small island nations and territories lack a Natural Earth geometry or FAO reporting. Values are prevalence estimates, not measured headcounts. Not suitable for subnational or annual inference.",
  },

  us_retail_surplus: {
    id: "us_retail_surplus",
    label: "US Retail Surplus",
    detail: "Annual national, ReFED",
    pmtiles: GLOBAL_TILES_DIR + "us_retail_surplus.pmtiles",
    indicatorCode: "tons-surplus",
    indicatorName: "Modeled retail surplus (ReFED)",
    unit: "tons/year",
    sourceId: "refed_food_waste_monitor",
    publisher: "ReFED, Inc.",
    datasetName: "ReFED Food Waste Monitor",
    sourceName: "ReFED Food Waste Monitor",
    sourceUrl: "https://insights-engine.refed.org/food-waste-monitor",
    edition: "API metadata updated 2026-03-25",
    accessDate: "19 July 2026",
    license: "ReFED and source-licensor terms: informational, research, policy, and other non-commercial use with attribution and preserved notices/disclaimers; other or commercial use requires permission",
    termsUrl: "https://refed.org/terms-of-use/",
    methodologyUrl: "https://docs.refed.org/methodologies/food_waste_monitor/retail.html",
    notices: "Attribution does not imply ReFED endorsement. ReFED and source-owner notices and disclaimers remain in force.",
    provenanceClass: "modeled_estimate",
    nativeResolution: "National (US only, annual)",
    periods: Array.from({length: 9}, (_, i) => String(2016 + i)),
    // Color: warm reds
    colorStops: [
      [0, "#f7f7f7"], [10000000, "#fddbc7"], [15000000, "#f4a582"],
      [20000000, "#d6604d"], [25000000, "#b2182b"], [30000000, "#67001f"],
    ],
    legendTitle: "Retail Surplus (tons/year)",
    legendLabels: ["0", "10M", "15M", "20M", "25M", "30M+"],
    legendColors: ["#f7f7f7", "#fddbc7", "#f4a582", "#d6604d", "#b2182b", "#67001f"],
    limitations: "US national totals only — state-level data unavailable through public API. Modeled estimate, not measured surplus. Annual totals; no seasonal or daily breakdown. Single-country; no international comparison available.",
  },
};

// ── Portland color scales ────────────────────────────────────────────────────

const PORTLAND_SURPLUS_COLORS = {
  stops: [[-1, "#FDECEA"], [0, "#F5F5F5"], [0.5, "#F5B7B1"], [1, "#E74C3C"], [2, "#922B21"], [3, "#641E16"]],
};
const PORTLAND_DEFICIT_COLORS = {
  stops: [[-1, "#EBF5FB"], [0, "#F5F5F5"], [0.5, "#AED6F1"], [1, "#3498DB"], [2, "#1A5276"], [3, "#0B2F4A"]],
};
const PORTLAND_ARBITRAGE_COLORS = {
  stops: [[-2, "#1A5276"], [-1, "#5DADE2"], [-0.3, "#D7BDE2"], [0, "#9B59B6"], [0.3, "#F1948A"], [1, "#E74C3C"], [2, "#922B21"]],
};

// ── Map initialization ───────────────────────────────────────────────────────

const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  center: PORTLAND_CENTER,
  zoom: PORTLAND_ZOOM,
  attributionControl: false,
});

map.addControl(new maplibregl.NavigationControl(), "top-right");

// We'll add attribution after map load based on active view

// ── Portland paint expressions ──────────────────────────────────────────────

function portlandPaint(layer) {
  let prop;
  if (layer === "surplus") {
    return ["interpolate", ["linear"], ["coalesce", ["get", "surplus_z"], 0], ...PORTLAND_SURPLUS_COLORS.stops.flat()];
  }
  if (layer === "deficit") {
    return ["interpolate", ["linear"], ["coalesce", ["get", "deficit_z"], 0], ...PORTLAND_DEFICIT_COLORS.stops.flat()];
  }
  return ["interpolate", ["linear"], ["coalesce", ["get", "net_mismatch"], 0], ...PORTLAND_ARBITRAGE_COLORS.stops.flat()];
}

function portlandOpacity(layer) {
  if (layer === "arbitrage") {
    return ["interpolate", ["linear"],
      ["+", ["max", ["coalesce", ["get", "surplus_z"], 0], 0], ["max", ["coalesce", ["get", "deficit_z"], 0], 0]],
      0, 0.05, 0.3, 0.3, 0.7, 0.5, 1.5, 0.65, 3, 0.8, 5, 0.9,
    ];
  }
  const prop = layer === "surplus" ? "surplus_z" : "deficit_z";
  return ["interpolate", ["linear"], ["abs", ["coalesce", ["get", prop], 0]], 0, 0.1, 0.5, 0.4, 1, 0.6, 2, 0.8, 3, 0.9];
}

// ── Layer Management ─────────────────────────────────────────────────────────

/** Remove all sources and layers from the map (except basemap). */
function clearAllLayers() {
  const layers = map.getStyle().layers || [];
  for (const l of layers) {
    if (l.id !== "background" && !l.id.startsWith("background-") && l.id !== "land" && l.id !== "water" && !l.id.startsWith("water")) {
      try { map.removeLayer(l.id); } catch (e) { /* may already be removed */ }
    }
  }
  const sources = map.getStyle().sources || {};
  for (const sid of Object.keys(sources)) {
    if (sid !== "composite" && sid !== "carto" && !sid.startsWith("carto")) {
      try { map.removeSource(sid); } catch (e) { /* may already be removed */ }
    }
  }
}

// ── Portland View ────────────────────────────────────────────────────────────

function setupPortlandView() {
  if (!map.getSource("hexagons")) {
    map.addSource("hexagons", {
      type: "vector",
      url: "pmtiles://" + PORTLAND_PMTILES,
    });
  }

  if (!map.getLayer("hex-fill")) {
    map.addLayer({
      id: "hex-fill",
      type: "fill",
      source: "hexagons",
      "source-layer": "hexagons",
      paint: {
        "fill-color": portlandPaint(activePortlandLayer),
        "fill-opacity": portlandOpacity(activePortlandLayer),
      },
    });
  }

  if (!map.getLayer("hex-outline")) {
    map.addLayer({
      id: "hex-outline",
      type: "line",
      source: "hexagons",
      "source-layer": "hexagons",
      paint: {
        "line-color": "rgba(255,255,255,0.12)",
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0, 10, 0.3, 12, 0.5, 14, 0.8],
      },
    });
  }

  if (!map.getLayer("hex-hover")) {
    map.addLayer({
      id: "hex-hover",
      type: "line",
      source: "hexagons",
      "source-layer": "hexagons",
      paint: { "line-color": "#fff", "line-width": 2, "line-opacity": 0.9 },
      filter: ["==", ["get", "h3"], ""],
    });
  }

  map.flyTo({ center: PORTLAND_CENTER, zoom: PORTLAND_ZOOM, duration: 800 });

  updateAttribution("portland");
  renderPortlandLegend(activePortlandLayer);
  updateInfoPanel("portland");
}

function updatePortlandLayer(layer) {
  activePortlandLayer = layer;
  if (map.getLayer("hex-fill")) {
    map.setPaintProperty("hex-fill", "fill-color", portlandPaint(layer));
    map.setPaintProperty("hex-fill", "fill-opacity", portlandOpacity(layer));
  }
  renderPortlandLegend(layer);
}

function renderPortlandLegend(layer) {
  const el = document.getElementById("legend");
  const cfgs = {
    surplus: { title: "Estimated Food Surplus (z-score)", colors: ["#F5F5F5", "#F5B7B1", "#E74C3C", "#922B21", "#641E16"], labels: ["None", "", "Moderate", "", "High"] },
    deficit: { title: "Food Access Deficit (z-score)", colors: ["#F5F5F5", "#AED6F1", "#3498DB", "#1A5276", "#0B2F4A"], labels: ["None", "", "Moderate", "", "Severe"] },
    arbitrage: { title: "Net Mismatch (surplus − deficit)", colors: ["#1A5276", "#5DADE2", "#9B59B6", "#E74C3C", "#922B21"], labels: ["Deficit", "", "Both", "", "Surplus"] },
  };
  const c = cfgs[layer];
  el.innerHTML = `<div class="legend-title">${c.title}</div>
    <div class="legend-bar">${c.colors.map(x => `<div style="flex:1;background:${x}"></div>`).join("")}</div>
    <div class="legend-labels">${c.labels.map(l => `<span>${l}</span>`).join("")}</div>`;
}

// ── Global View ──────────────────────────────────────────────────────────────

function getGlobalMeasure() {
  return MEASURES[activeGlobalMeasure];
}

function setupGlobalView() {
  const m = getGlobalMeasure();

  // Add or replace source
  if (map.getSource("global-temporal")) {
    map.removeSource("global-temporal");
  }
  map.addSource("global-temporal", {
    type: "vector",
    url: "pmtiles://" + m.pmtiles,
  });

  // Add fill layer if not present
  if (!map.getLayer("global-fill")) {
    map.addLayer({
      id: "global-fill",
      type: "fill",
      source: "global-temporal",
      "source-layer": m.id,
      paint: {
        "fill-color": buildGlobalColorExpression(m),
        "fill-opacity": 0.85,
      },
    });
  } else {
    // Update source layer name and paint
    map.setLayoutProperty("global-fill", "visibility", "visible");
    // For source-layer change, we need to remove and re-add the layer
    map.removeLayer("global-fill");
    map.addLayer({
      id: "global-fill",
      type: "fill",
      source: "global-temporal",
      "source-layer": m.id,
      paint: {
        "fill-color": buildGlobalColorExpression(m),
        "fill-opacity": 0.85,
      },
    });
  }

  // Outline
  if (!map.getLayer("global-outline")) {
    map.addLayer({
      id: "global-outline",
      type: "line",
      source: "global-temporal",
      "source-layer": m.id,
      paint: { "line-color": "rgba(255,255,255,0.2)", "line-width": 0.5 },
    });
  }

  // Hover highlight
  if (!map.getLayer("global-hover")) {
    map.addLayer({
      id: "global-hover",
      type: "line",
      source: "global-temporal",
      "source-layer": m.id,
      paint: { "line-color": "#fff", "line-width": 1.5, "line-opacity": 0.9 },
      filter: ["==", ["get", "period_label"], "__none__"],
    });
  }

  // Set filter to current period
  applyPeriodFilter();

  // Fly to world view if coming from Portland
  map.flyTo({ center: [0, 30], zoom: 1.5, duration: 1000 });

  updateAttribution("global");
  renderGlobalLegend(m);
  renderTimeControls(m);
  updateInfoPanel("global");
}

function buildGlobalColorExpression(measure) {
  const stops = measure.colorStops;
  // Missingness is explicit in the tiles. Branch before numeric interpolation;
  // never coalesce an unavailable value to zero.
  const valueExpr = ["interpolate", ["linear"], ["get", "value"]];
  for (const [val, color] of stops) {
    valueExpr.push(val, color);
  }
  return ["case", ["==", ["get", "is_missing"], true], GLOBAL_MISSING_COLOR, valueExpr];
}

function applyPeriodFilter() {
  const m = getGlobalMeasure();
  const periods = m.periods;
  if (periods.length === 0) return;
  const period = periods[currentPeriodIdx];

  if (map.getLayer("global-fill")) {
    map.setFilter("global-fill", ["==", ["get", "period_label"], period]);
  }
  if (map.getLayer("global-outline")) {
    map.setFilter("global-outline", ["==", ["get", "period_label"], period]);
  }
}

function buildGlobalLegendHtml(m) {
  return `<div class="legend-title">${m.legendTitle}</div>
    <div class="legend-bar">${m.legendColors.map(c => `<div style="flex:1;background:${c}"></div>`).join("")}</div>
    <div class="legend-labels">${m.legendLabels.map(l => `<span>${l}</span>`).join("")}</div>
    <div class="legend-no-data"><span style="display:inline-block;width:12px;height:12px;margin-right:6px;background:${GLOBAL_MISSING_COLOR};border:1px solid rgba(255,255,255,0.45)"></span>No data</div>`;
}

function renderGlobalLegend(m) {
  document.getElementById("legend").innerHTML = buildGlobalLegendHtml(m);
}

function renderTimeControls(m) {
  const periods = m.periods;
  currentPeriodIdx = Math.min(currentPeriodIdx, periods.length - 1);

  document.getElementById("measureLabel").textContent = m.label;
  document.getElementById("periodDisplay").textContent = periods[currentPeriodIdx];
  document.getElementById("periodSlider").max = periods.length - 1;
  document.getElementById("periodSlider").value = currentPeriodIdx;
  document.getElementById("periodCount").textContent = `${currentPeriodIdx + 1} / ${periods.length}`;
}

function setPeriod(idx) {
  const m = getGlobalMeasure();
  idx = Math.max(0, Math.min(idx, m.periods.length - 1));
  if (idx === currentPeriodIdx && map.getLayer("global-fill") && map.getFilter("global-fill")) return;

  currentPeriodIdx = idx;
  applyPeriodFilter();
  document.getElementById("periodDisplay").textContent = m.periods[idx];
  document.getElementById("periodSlider").value = idx;
  document.getElementById("periodCount").textContent = `${idx + 1} / ${m.periods.length}`;
  renderGlobalDisclosure(m);
}

function startPlayback() {
  if (isPlaying) return;
  isPlaying = true;
  document.getElementById("playBtn").textContent = "⏸";
  advancePlayback();
}

function stopPlayback() {
  isPlaying = false;
  if (playTimer) clearTimeout(playTimer);
  document.getElementById("playBtn").textContent = "▶";
}

function advancePlayback() {
  if (!isPlaying) return;
  const m = getGlobalMeasure();
  const next = (currentPeriodIdx + 1) % m.periods.length;
  setPeriod(next);
  const speed = parseInt(document.getElementById("speedSelect").value) || 1500;
  playTimer = setTimeout(advancePlayback, speed);
}

function switchGlobalMeasure(measureId) {
  activeGlobalMeasure = measureId;
  document.querySelectorAll(".measure-btn").forEach(b => b.classList.remove("active"));
  document.querySelector(`[data-measure="${measureId}"]`).classList.add("active");

  stopPlayback();

  const m = getGlobalMeasure();

  // Remove old global layers to switch source-layer
  try { map.removeLayer("global-hover"); } catch (e) {}
  try { map.removeLayer("global-outline"); } catch (e) {}
  try { map.removeLayer("global-fill"); } catch (e) {}
  try { map.removeSource("global-temporal"); } catch (e) {}

  currentPeriodIdx = 0;
  setupGlobalView();
}

// ── Attribution ──────────────────────────────────────────────────────────────

function updateAttribution(view) {
  // Remove existing attribution controls
  const existing = document.querySelectorAll(".maplibregl-ctrl-attrib");
  existing.forEach(el => el.remove());

  if (view === "portland") {
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: 'Data: <a href="https://www.ers.usda.gov/data-products/food-access-research-atlas/">USDA</a>, <a href="https://www.openstreetmap.org/">OSM</a>, <a href="https://refed.org/">ReFED</a>',
      }),
      "bottom-right"
    );
  } else {
    const m = getGlobalMeasure();
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: `Data: <a href="${m.sourceUrl}">${m.datasetName}</a> | ${m.edition} | <a href="${m.termsUrl}">terms</a>`,
      }),
      "bottom-right"
    );
  }
}

// ── Info Panel ───────────────────────────────────────────────────────────────

function disclosureLink(url, label) {
  return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function renderGlobalDisclosure(m) {
  document.getElementById("discPublisher").textContent = m.publisher;
  document.getElementById("discDataset").innerHTML = disclosureLink(m.sourceUrl, m.datasetName);
  document.getElementById("discIndicator").textContent = m.indicatorName;
  document.getElementById("discPeriod").textContent = m.periods[currentPeriodIdx] || "—";
  document.getElementById("discUnit").textContent = m.unit;
  document.getElementById("discResolution").textContent = m.nativeResolution;
  document.getElementById("discClass").textContent = m.provenanceClass;
  document.getElementById("discEdition").textContent = m.edition;
  document.getElementById("discAccessed").textContent = m.accessDate;
  document.getElementById("discLicense").innerHTML = `${m.license}. ${disclosureLink(m.termsUrl, "Terms")}`;
  document.getElementById("discMethodology").innerHTML = disclosureLink(m.methodologyUrl, "Methodology");
  document.getElementById("discNotices").textContent = m.notices;
  document.getElementById("discLimits").textContent = m.limitations;
}

function updateInfoPanel(view) {
  const infoText = document.getElementById("infoText");
  const globalInfo = document.getElementById("globalInfo");
  const discBody = document.getElementById("disclosureBody");

  if (view === "portland") {
    infoText.style.display = "inline";
    globalInfo.style.display = "none";
    discBody.classList.remove("open");
  } else {
    infoText.style.display = "none";
    globalInfo.style.display = "inline";

    const m = getGlobalMeasure();
    renderGlobalDisclosure(m);
  }
}

// ── View Switching ───────────────────────────────────────────────────────────

function switchView(view) {
  if (view === activeView) return;
  activeView = view;

  document.querySelectorAll(".view-btn").forEach(b => b.classList.remove("active"));
  document.querySelector(`[data-view="${view}"]`).classList.add("active");

  // Show/hide controls
  document.getElementById("portlandControls").style.display = view === "portland" ? "block" : "none";
  document.getElementById("globalControls").style.display = view === "global" ? "block" : "none";

  // Update subtitle
  const subtitle = view === "portland"
    ? "Food surplus and deficit mapped together. Portland, OR. <br><small style='color:#888;'>Proxy-based static local specimen.</small>"
    : "Historical indicators related to food loss and undernourishment.<br><small style='color:#888;'>Measures are shown separately; no global arbitrage score is calculated.</small>";
  document.getElementById("sidebarSubtitle").innerHTML = subtitle;

  stopPlayback();
  clearAllLayers();

  if (view === "portland") {
    setupPortlandView();
  } else {
    currentPeriodIdx = 0;
    setupGlobalView();
  }
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

const tooltipEl = document.getElementById("tooltip");

function formatPortlandTooltip(props, layer) {
  const lines = [];
  const estCount = props.establishment_count || 0;
  const surplusZ = (props.surplus_z || 0).toFixed(2);
  const deficitZ = (props.deficit_z || 0).toFixed(2);
  const regime = props.regime || "neutral";
  const arbScore = (props.arbitrage_score || 0).toFixed(2);

  if (layer === "surplus") {
    lines.push(`<strong>Surplus z:</strong> ${surplusZ}`);
    lines.push(`<strong>Establishments:</strong> ${estCount}`);
  } else if (layer === "deficit") {
    lines.push(`<strong>Deficit z:</strong> ${deficitZ}`);
  } else {
    lines.push(`<strong>Regime:</strong> ${regime}`);
    lines.push(`<strong>Surplus z:</strong> ${surplusZ}`);
    lines.push(`<strong>Deficit z:</strong> ${deficitZ}`);
    if (regime === "arbitrage") lines.push(`<strong>Arbitrage score:</strong> ${arbScore}`);
  }
  return lines.join("<br>");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function formatGlobalTooltip(props) {
  const m = getGlobalMeasure();
  const lines = [];
  const isMissing = props.is_missing === true || props.is_missing === 1 || props.is_missing === "true";
  const valueLabel = isMissing ? "No data available" : `${Number(props.value).toFixed(1)} ${m.unit}`;
  const geographyLabel = props.area_name || props.area_code || "Unknown geography";
  lines.push(`<strong>${escapeHtml(geographyLabel)}:</strong> ${escapeHtml(valueLabel)}`);
  lines.push(`<strong>Publisher:</strong> ${escapeHtml(m.publisher)}`);
  lines.push(`<strong>Dataset:</strong> ${escapeHtml(m.datasetName)}`);
  lines.push(`<strong>Indicator:</strong> ${escapeHtml(m.indicatorName)}`);
  lines.push(`<strong>Period:</strong> ${escapeHtml(props.period_label || "—")}`);
  lines.push(`<strong>Unit:</strong> ${escapeHtml(m.unit)}`);
  lines.push(`<strong>Provenance:</strong> ${escapeHtml(props.provenance_class || m.provenanceClass)}`);
  lines.push(`<strong>Edition:</strong> ${escapeHtml(m.edition)}`);
  lines.push(`<strong>Accessed:</strong> ${escapeHtml(m.accessDate)}`);
  lines.push(`<strong>License:</strong> <a href="${m.termsUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(m.license)}</a>`);
  return lines.join("<br>");
}

// ── Map Load ─────────────────────────────────────────────────────────────────

map.on("load", () => {
  setupPortlandView();

  // ── View Switcher ──
  document.querySelectorAll(".view-btn").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  // ── Portland Layer Buttons ──
  document.querySelectorAll(".layer-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".layer-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      updatePortlandLayer(btn.dataset.layer);
    });
  });

  // ── Global Measure Buttons ──
  document.querySelectorAll(".measure-btn").forEach(btn => {
    btn.addEventListener("click", () => switchGlobalMeasure(btn.dataset.measure));
  });

  // ── Period Slider ──
  document.getElementById("periodSlider").addEventListener("input", (e) => {
    stopPlayback();
    setPeriod(parseInt(e.target.value));
  });

  // ── Play/Pause ──
  document.getElementById("playBtn").addEventListener("click", () => {
    if (isPlaying) stopPlayback(); else startPlayback();
  });

  // ── Prev/Next ──
  document.getElementById("prevBtn").addEventListener("click", () => {
    stopPlayback();
    setPeriod(currentPeriodIdx - 1);
  });
  document.getElementById("nextBtn").addEventListener("click", () => {
    stopPlayback();
    setPeriod(currentPeriodIdx + 1);
  });

  // ── Disclosure Toggle ──
  document.getElementById("disclosureToggle").addEventListener("click", () => {
    const body = document.getElementById("disclosureBody");
    const toggle = document.getElementById("disclosureToggle");
    body.classList.toggle("open");
    toggle.textContent = body.classList.contains("open") ? "▼ Source & Evidence" : "▶ Source & Evidence";
  });

  // ── Tooltip: Portland ──
  map.on("mousemove", "hex-fill", (e) => {
    if (activeView !== "portland" || !e.features || !e.features.length) return;
    const props = e.features[0].properties;
    tooltipEl.innerHTML = formatPortlandTooltip(props, activePortlandLayer);
    tooltipEl.style.display = "block";
    tooltipEl.style.left = e.point.x + 12 + "px";
    tooltipEl.style.top = e.point.y - 12 + "px";
    map.setFilter("hex-hover", ["==", ["get", "h3"], props.h3 || ""]);
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "hex-fill", () => {
    tooltipEl.style.display = "none";
    try { map.setFilter("hex-hover", ["==", ["get", "h3"], ""]); } catch (e) {}
    map.getCanvas().style.cursor = "";
  });

  // ── Tooltip: Global ──
  map.on("mousemove", "global-fill", (e) => {
    if (activeView !== "global" || !e.features || !e.features.length) return;
    const props = e.features[0].properties;
    tooltipEl.innerHTML = formatGlobalTooltip(props);
    tooltipEl.style.display = "block";
    tooltipEl.style.left = e.point.x + 12 + "px";
    tooltipEl.style.top = e.point.y - 12 + "px";
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "global-fill", () => {
    tooltipEl.style.display = "none";
    map.getCanvas().style.cursor = "";
  });
});

// ── Keyboard shortcuts ───────────────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (activeView !== "global") return;
  if (e.key === " " || e.key === "Spacebar") {
    e.preventDefault();
    if (isPlaying) stopPlayback(); else startPlayback();
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    stopPlayback();
    setPeriod(currentPeriodIdx - 1);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    stopPlayback();
    setPeriod(currentPeriodIdx + 1);
  }
});
