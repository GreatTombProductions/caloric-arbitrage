#!/usr/bin/env node
/**
 * Caloric Arbitrage — Frontend Tests
 *
 * Validates data structures, HTML elements, measure definitions,
 * and static asset availability. Run with Node.js (no browser needed).
 *
 * Usage:
 *   node test.js
 *   node test.js --project-root /absolute/path/to/root-layout-candidate
 */

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = process.argv.includes("--project-root")
  ? process.argv[process.argv.indexOf("--project-root") + 1]
  : path.resolve(__dirname);
const FRONTEND_DIR = PROJECT_ROOT;
const TILES_DIR = path.join(PROJECT_ROOT, "tiles");
const GLOBAL_TILES_DIR = path.join(PROJECT_ROOT, "data", "global-temporal", "tiles");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

// ── 1. HTML structure ─────────────────────────────────────────────────────────

console.log("\n=== HTML Structure ===");

const html = fs.readFileSync(path.join(FRONTEND_DIR, "index.html"), "utf-8");

test("has view switcher", () => {
  assert(html.includes("view-switcher"), "missing view-switcher");
  assert(html.includes('data-view="portland"'), "missing portland view button");
  assert(html.includes('data-view="global"'), "missing global view button");
});

test("has portland controls", () => {
  assert(html.includes("portlandControls"), "missing portlandControls div");
  assert(html.includes('data-layer="arbitrage"'), "missing arbitrage layer button");
  assert(html.includes('data-layer="surplus"'), "missing surplus layer button");
  assert(html.includes('data-layer="deficit"'), "missing deficit layer button");
});

test("has global controls", () => {
  assert(html.includes("globalControls"), "missing globalControls div");
  assert(html.includes('data-measure="global_loss_annual"'), "missing loss annual button");
  assert(html.includes('data-measure="global_undernourishment_3yr"'), "missing undernourishment button");
  assert(html.includes('data-measure="us_retail_surplus"'), "missing us retail surplus button");
});

test("has time controls", () => {
  assert(html.includes("periodSlider"), "missing periodSlider");
  assert(html.includes("playBtn"), "missing playBtn");
  assert(html.includes("prevBtn"), "missing prevBtn");
  assert(html.includes("nextBtn"), "missing nextBtn");
  assert(html.includes("speedSelect"), "missing speedSelect");
  assert(html.includes("periodDisplay"), "missing periodDisplay");
  assert(html.includes("periodCount"), "missing periodCount");
});

test("has disclosure panel", () => {
  assert(html.includes("disclosureBody"), "missing disclosureBody");
  assert(html.includes("disclosureToggle"), "missing disclosureToggle");
  assert(html.includes("discPublisher"), "missing discPublisher");
  assert(html.includes("discDataset"), "missing discDataset");
  assert(html.includes("discLimits"), "missing discLimits");
});

test("has info panel", () => {
  assert(html.includes('id="infoText"'), "missing infoText");
  assert(html.includes('id="globalInfo"'), "missing globalInfo");
});

test("has tooltip", () => {
  assert(html.includes('id="tooltip"'), "missing tooltip");
});

test("has map container", () => {
  assert(html.includes('id="map"'), "missing map div");
});

test("Portland labeled as proxy specimen", () => {
  assert(html.includes("Proxy"), "missing 'Proxy' label for Portland");
});

test("no live/real-time claims in HTML", () => {
  const forbidden = ["real-time", "right now", "live calories", "available calories", "move food", "24-hour"];
  for (const term of forbidden) {
    const re = new RegExp(term, "i");
    assert(!re.test(html), `found forbidden term: "${term}"`);
  }
});

test("has prefers-reduced-motion", () => {
  assert(html.includes("prefers-reduced-motion"), "missing reduced-motion media query");
});

// ── 2. JavaScript Data Structures ──────────────────────────────────────────────

console.log("\n=== JavaScript Data Structures ===");

const jsRaw = fs.readFileSync(path.join(FRONTEND_DIR, "app.js"), "utf-8");

// Extract MEASURES object by finding the JSON-like definition
// We'll use a simple approach: evaluate the measure definitions
test("app.js is syntactically valid", () => {
  try {
    new Function(jsRaw);
    assert(true);
  } catch (e) {
    throw new Error(`syntax error: ${e.message}`);
  }
});

// Evaluate the JS to inspect MEASURES and pure presentation functions.
let MEASURES;
let FRONTEND_API;
const sandbox = {
  pmtiles: { Protocol: function() { return { tile: () => {} }; } },
  maplibregl: {
    addProtocol: () => {},
    Map: function() { return { on: () => {}, addControl: () => {}, addSource: () => {}, addLayer: () => {}, getSource: () => null, getLayer: () => null, getStyle: () => ({ layers: [], sources: {} }), setFilter: () => {}, setPaintProperty: () => {}, setLayoutProperty: () => {}, removeLayer: () => {}, removeSource: () => {}, flyTo: () => {}, getCanvas: () => ({ style: {} }), getFilter: () => null }; },
    NavigationControl: function() {},
    AttributionControl: function() {},
  },
  document: {
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
  },
  window: { location: { href: "http://localhost:8765/" } },
  URL: URL,
  setTimeout: () => {},
  clearTimeout: () => {},
  console: { log: () => {}, warn: () => {}, error: () => {} },
};
try {
  const fn = new Function(
    ...Object.keys(sandbox),
    jsRaw + "; return { MEASURES, buildGlobalColorExpression, buildGlobalLegendHtml, formatGlobalTooltip };"
  );
  FRONTEND_API = fn(...Object.values(sandbox));
  MEASURES = FRONTEND_API.MEASURES;
} catch (e) {
  // FRONTEND_API may be undefined if the browser API sandbox is incomplete.
}

if (MEASURES) {
  const requiredFields = ["id", "label", "detail", "pmtiles", "indicatorCode", "indicatorName", "unit", "sourceId", "publisher", "datasetName", "sourceName", "sourceUrl", "edition", "accessDate", "license", "termsUrl", "methodologyUrl", "notices", "provenanceClass", "nativeResolution", "periods", "colorStops", "legendTitle", "legendLabels", "legendColors", "limitations"];

  for (const [key, m] of Object.entries(MEASURES)) {
    test(`measure "${key}" has all required fields`, () => {
      for (const field of requiredFields) {
        assert(m[field] !== undefined, `missing field: ${field}`);
      }
    });
  }

  test("loss annual periods: 2000–2024", () => {
    const p = MEASURES.global_loss_annual.periods;
    assert(p.length === 25, `expected 25 periods, got ${p.length}`);
    assert(p[0] === "2000", `first period should be 2000, got ${p[0]}`);
    assert(p[24] === "2024", `last period should be 2024, got ${p[24]}`);
  });

  test("undernourishment periods: 2000-2002 through 2022-2024", () => {
    const p = MEASURES.global_undernourishment_3yr.periods;
    assert(p.length === 23, `expected 23 periods, got ${p.length}`);
    assert(p[0] === "2000-2002", `first period should be 2000-2002, got ${p[0]}`);
    assert(p[22] === "2022-2024", `last period should be 2022-2024, got ${p[22]}`);
  });

  test("us retail surplus periods: 2016–2024", () => {
    const p = MEASURES.us_retail_surplus.periods;
    assert(p.length === 9, `expected 9 periods, got ${p.length}`);
    assert(p[0] === "2016", `first should be 2016, got ${p[0]}`);
    assert(p[8] === "2024", `last should be 2024, got ${p[8]}`);
  });

  test("color stops have even number of entries", () => {
    for (const [key, m] of Object.entries(MEASURES)) {
      const stops = m.colorStops;
      assert(stops.length >= 2, `${key}: need at least 2 stops, got ${stops.length}`);
      for (const stop of stops) {
        assert(Array.isArray(stop) && stop.length === 2, `${key}: each stop must be [value, color]`);
        assert(typeof stop[0] === "number", `${key}: stop value must be number`);
        assert(typeof stop[1] === "string" && stop[1].startsWith("#"), `${key}: stop color must be hex string`);
      }
    }
  });

  test("legend colors match legend labels length", () => {
    for (const [key, m] of Object.entries(MEASURES)) {
      assert(m.legendColors.length === m.legendLabels.length,
        `${key}: legendColors (${m.legendColors.length}) != legendLabels (${m.legendLabels.length})`);
    }
  });

  test("no live/real-time language in limitations", () => {
    for (const [key, m] of Object.entries(MEASURES)) {
      const forbidden = ["real-time", "right now", "live", "24 hour", "available now"];
      for (const term of forbidden) {
        const re = new RegExp(term, "i");
        assert(!re.test(m.limitations), `${key}: forbidden term in limitations: "${term}"`);
      }
    }
  });

  test("all measures declare provenance as modeled_estimate", () => {
    for (const [key, m] of Object.entries(MEASURES)) {
      assert(m.provenanceClass === "modeled_estimate",
        `${key}: provenanceClass should be modeled_estimate, got ${m.provenanceClass}`);
    }
  });

  test("all measures have non-empty periods", () => {
    for (const [key, m] of Object.entries(MEASURES)) {
      assert(m.periods.length > 0, `${key}: periods is empty`);
    }
  });

  test("period labels are strings", () => {
    for (const [key, m] of Object.entries(MEASURES)) {
      for (const p of m.periods) {
        assert(typeof p === "string", `${key}: period "${p}" is not a string`);
      }
    }
  });

  test("no JS-native forbidden claims in measure descriptions", () => {
    const forbidden = ["real-time", "live", "right now", "24-hour", "perishability", "actionable", "logistics", "leaderboard"];
    for (const [key, m] of Object.entries(MEASURES)) {
      for (const term of forbidden) {
        const re = new RegExp(term, "i");
        const haystack = JSON.stringify([m.label, m.detail, m.indicatorName, m.limitations]);
        assert(!re.test(haystack), `${key}: forbidden term "${term}" in measure text`);
      }
    }
  });
} else {
  console.log("  ⚠ Could not evaluate MEASURES from app.js (browser API mismatch)");
}

console.log("\n=== Missing-Value Semantics ===");

test("global color expression branches on is_missing without numeric coalescing", () => {
  assert(FRONTEND_API, "could not evaluate frontend API");
  const expr = FRONTEND_API.buildGlobalColorExpression(MEASURES.global_undernourishment_3yr);
  assert(expr[0] === "case", "missingness must be handled before interpolation");
  assert(JSON.stringify(expr[1]) === JSON.stringify(["==", ["get", "is_missing"], true]),
    "missingness branch must read explicit is_missing marker");
  assert(!JSON.stringify(expr).includes('"coalesce"'), "missing values must not be coalesced to zero");
});

test("global legend explains the gray No data treatment", () => {
  assert(FRONTEND_API, "could not evaluate frontend API");
  const legend = FRONTEND_API.buildGlobalLegendHtml(MEASURES.global_undernourishment_3yr);
  assert(legend.includes("No data"), "legend lacks No data key");
  assert(legend.includes("#737373"), "legend lacks the missing-value fill color");
});

test("missing tooltip says No data available and preserves context", () => {
  assert(FRONTEND_API, "could not evaluate frontend API");
  const tooltip = FRONTEND_API.formatGlobalTooltip({
    area_name: "Example",
    value: 0,
    is_missing: true,
    period_label: "2000-2002",
    provenance_class: "modeled_estimate",
  });
  assert(tooltip.includes("No data available"), "missing tooltip presents a numeric value");
  assert(tooltip.includes("2000-2002"), "missing tooltip dropped period context");
  assert(tooltip.includes("modeled_estimate"), "missing tooltip dropped evidence context");
});

test("numeric zero remains distinct from missing", () => {
  assert(FRONTEND_API, "could not evaluate frontend API");
  const tooltip = FRONTEND_API.formatGlobalTooltip({
    area_name: "Example",
    value: 0,
    is_missing: false,
    period_label: "2000-2002",
    provenance_class: "modeled_estimate",
  });
  assert(tooltip.includes("0.0 %"), "numeric zero was not rendered as data");
  assert(!tooltip.includes("No data available"), "numeric zero was classified as missing");
});

test("valid global feature tooltip renders its geography name", () => {
  assert(FRONTEND_API, "could not evaluate frontend API");
  const tooltip = FRONTEND_API.formatGlobalTooltip({
    area_name: "Germany",
    area_code: "79",
    value: 2,
    is_missing: false,
    period_label: "2003",
    provenance_class: "modeled_estimate",
  });
  assert(tooltip.includes("<strong>Germany:</strong>"), "tooltip dropped the geography name");
  assert(!tooltip.includes("<strong>Country:</strong>"), "tooltip used the generic Country fallback");
});

test("global subtitle states that measures are separate with no arbitrage score", () => {
  assert(jsRaw.includes("Measures are shown separately; no global arbitrage score is calculated."),
    "global subtitle does not explain separate measures and absent arbitrage score");
});

console.log("\n=== Pages Root and Evidence Boundary ===");

test("asset paths are root-layout relative with no parent escape", () => {
  assert(jsRaw.includes('resolvePath("./tiles/caloric_arbitrage.pmtiles")'), "Portland path is not Pages-root relative");
  assert(jsRaw.includes('resolvePath("./data/global-temporal/tiles/")'), "global path is not Pages-root relative");
  assert(!jsRaw.includes('resolvePath("../'), "receiver retains a parent-directory path escape");
});

test("asset paths stay inside localhost and GitHub Pages prefixes", () => {
  const local = new URL("./tiles/caloric_arbitrage.pmtiles", "http://localhost:8765/");
  const pages = new URL("./data/global-temporal/tiles/global_loss_annual.pmtiles", "https://greattombproductions.github.io/caloric-arbitrage/");
  assert(local.href === "http://localhost:8765/tiles/caloric_arbitrage.pmtiles", `bad localhost resolution: ${local.href}`);
  assert(pages.href === "https://greattombproductions.github.io/caloric-arbitrage/data/global-temporal/tiles/global_loss_annual.pmtiles", `bad Pages resolution: ${pages.href}`);
  assert(pages.pathname.startsWith("/caloric-arbitrage/"), "Pages URL escaped repository prefix");
});

test("retired external widget dependency is absent", () => {
  assert(!/<script[^>]+data-project=/i.test(html), "retired project widget script remains");
  assert(!html.includes(":8082/"), "retired external port remains");
});

test("rendered disclosure has every frozen evidence field", () => {
  for (const id of ["discPublisher", "discDataset", "discIndicator", "discPeriod", "discUnit", "discResolution", "discClass", "discEdition", "discAccessed", "discLicense", "discMethodology", "discNotices", "discLimits"]) {
    assert(html.includes(`id="${id}"`), `missing rendered disclosure field ${id}`);
  }
});

test("measure definitions carry real source, methodology, and terms links", () => {
  for (const [key, m] of Object.entries(MEASURES)) {
    for (const field of ["publisher", "datasetName", "indicatorName", "unit", "provenanceClass", "edition", "accessDate", "license", "termsUrl", "methodologyUrl", "notices"]) {
      assert(typeof m[field] === "string" && m[field].length > 0, `${key}: empty ${field}`);
    }
    assert(new URL(m.sourceUrl).protocol === "https:", `${key}: source URL is not HTTPS`);
    assert(new URL(m.termsUrl).protocol === "https:", `${key}: terms URL is not HTTPS`);
    assert(new URL(m.methodologyUrl).protocol === "https:", `${key}: methodology URL is not HTTPS`);
  }
  assert(MEASURES.global_loss_annual.termsUrl.includes("fao.org/contact-us/terms"), "FAO terms link is not authoritative");
  assert(MEASURES.us_retail_surplus.termsUrl === "https://refed.org/terms-of-use/", "ReFED terms link is incorrect");
});

test("global tooltip exposes the complete evidence contract", () => {
  assert(FRONTEND_API, "could not evaluate frontend API");
  const tooltip = FRONTEND_API.formatGlobalTooltip({
    area_name: "Canada", value: 2.1, is_missing: false,
    period_label: "2000", provenance_class: "modeled_estimate",
  });
  for (const label of ["Publisher:", "Dataset:", "Indicator:", "Period:", "Unit:", "Provenance:", "Edition:", "Accessed:", "License:"]) {
    assert(tooltip.includes(label), `tooltip lacks ${label}`);
  }
  assert(tooltip.includes("https://www.fao.org/contact-us/terms/db-terms-of-use/en/"), "tooltip lacks real FAO terms link");
});

test("public README documents only shipped commands and separates data terms", () => {
  const readme = fs.readFileSync(path.join(PROJECT_ROOT, "README.md"), "utf8");
  assert(readme.includes("bash serve.sh"), "README lacks local serving command");
  assert(readme.includes("node test.js"), "README lacks shipped test command");
  assert(fs.existsSync(path.join(PROJECT_ROOT, "serve.sh")), "README references absent serve.sh");
  assert(fs.existsSync(path.join(PROJECT_ROOT, "test.js")), "README references absent test.js");
  for (const absent of ["requirements.txt", "pipeline.run", "pipeline/global_temporal/build.py", "pipeline/global_temporal/generate_tiles.py"]) {
    assert(!readme.includes(absent), `README references absent build input ${absent}`);
  }
  assert(readme.includes("MIT license") && readme.includes("does **not** relicense source data"), "README does not separate software and data licenses");
  for (const link of ["https://www.fao.org/contact-us/terms/db-terms-of-use/en/", "https://refed.org/terms-of-use/", "https://docs.refed.org/methodologies/food_waste_monitor/retail.html"]) {
    assert(readme.includes(link), `README lacks ${link}`);
  }
});

// ── 3. Static Assets ──────────────────────────────────────────────────────────

console.log("\n=== Static Assets ===");

test("Portland PMTiles exists", () => {
  const p = path.join(TILES_DIR, "caloric_arbitrage.pmtiles");
  assert(fs.existsSync(p), `${p} not found`);
  assert(fs.statSync(p).size > 0, `${p} is empty`);
});

test("global_loss_annual.pmtiles exists", () => {
  const p = path.join(GLOBAL_TILES_DIR, "global_loss_annual.pmtiles");
  assert(fs.existsSync(p), `${p} not found`);
  assert(fs.statSync(p).size > 0, `${p} is empty`);
});

test("global_undernourishment_3yr.pmtiles exists", () => {
  const p = path.join(GLOBAL_TILES_DIR, "global_undernourishment_3yr.pmtiles");
  assert(fs.existsSync(p), `${p} not found`);
  assert(fs.statSync(p).size > 0, `${p} is empty`);
});

test("us_retail_surplus.pmtiles exists", () => {
  const p = path.join(GLOBAL_TILES_DIR, "us_retail_surplus.pmtiles");
  assert(fs.existsSync(p), `${p} not found`);
  assert(fs.statSync(p).size > 0, `${p} is empty`);
});

test("receiver files live at the Pages root", () => {
  for (const filename of ["index.html", "app.js", "test.js", "README.md", "LICENSE", "serve.sh"]) {
    const candidate = path.join(PROJECT_ROOT, filename);
    assert(fs.existsSync(candidate), `${filename} is absent from the Pages root`);
    assert(fs.statSync(candidate).size > 0, `${filename} is empty`);
  }
  assert(!fs.existsSync(path.join(PROJECT_ROOT, "frontend")), "unexpected intermediate frontend/ directory");
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(50)}`);
console.log(`  ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"═".repeat(50)}`);

process.exit(failed > 0 ? 1 : 0);
