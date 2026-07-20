# Caloric Arbitrage

A static, interactive map that makes selected food-loss, undernourishment, and food-access patterns visible without presenting them as current food availability.

## Views

### Portland (local proxy)

A high-resolution H3 grid for Portland, Oregon. The surplus channel is a static proxy derived from OpenStreetMap food-establishment density and sector waste-rate assumptions. The deficit channel uses USDA Food Access Research Atlas indicators. The pattern is illustrative; magnitudes are not measured calories and do not identify food available for pickup.

### Global historical

Three independently displayed modeled series:

- **Caloric Loss:** FAOSTAT item 21059, annual country-level estimates for 2000–2024.
- **Undernourishment:** FAOSTAT item 210041, overlapping three-year country-level modeled estimates from 2000–2002 through 2022–2024.
- **US Retail Surplus:** ReFED Food Waste Monitor national annual modeled estimates for 2016–2024.

Periods are source-native and discrete. The receiver does not interpolate periods or calculate a global arbitrage score. Missing mapped observations remain visible as **No data** rather than becoming zero.

**This map does not show:** current producer surplus, named establishments with available food, forecasts, perishability countdowns, logistics routes, or calls to action. It is a historical evidence visualization, not an operational food-distribution tool.

## Run the shipped static distribution

The distribution contains prebuilt HTML, JavaScript, and PMTiles serving artifacts. It does not include the upstream data-acquisition or tile-generation pipeline and does not claim full source-data reproduction.

Requirements: Python 3 for the local server. Node.js is optional for the deterministic receiver tests.

```bash
bash serve.sh
# Open http://localhost:8765/
```

The included server supports HTTP byte ranges required by PMTiles.

Optional static checks:

```bash
node test.js
```

## Shipped layout

```text
index.html
app.js
test.js
serve.sh
LICENSE
tiles/
  caloric_arbitrage.pmtiles
  tile_manifest.json
data/global-temporal/tiles/
  global_loss_annual.pmtiles
  global_undernourishment_3yr.pmtiles
  us_retail_surplus.pmtiles
  tile-manifest.json
```

## Source data, attribution, and terms

The MIT license in `LICENSE` applies only to the software in this distribution. It does **not** relicense source data. Source terms and notices remain controlling.

### FAOSTAT global layers

- **Publisher:** Food and Agriculture Organization of the United Nations, Statistics Division, Food Security and Nutrition Statistics Team
- **Dataset:** [FAOSTAT Suite of Food Security Indicators](https://www.fao.org/faostat/en/#data/FS)
- **Indicators:** item 21059, *Incidence of caloric losses at retail distribution level (percent)*; item 210041, *Prevalence of undernourishment (percent) (3-year average)*
- **Edition:** dataset updated 2026-04-29; edition year 2026
- **Accessed:** 19 July 2026
- **License:** CC BY 4.0 unless dataset metadata identifies a third-party exception
- **Terms:** [FAO database terms of use](https://www.fao.org/contact-us/terms/db-terms-of-use/en/)

Citation: FAO. 2026. *FAOSTAT: Suite of Food Security Indicators*. Accessed 19 July 2026. https://www.fao.org/faostat/en/#data/FS. License: CC BY 4.0.

This is an open, non-commercial visualization. Attribution does not imply FAO endorsement.

### ReFED US layer

- **Publisher:** ReFED, Inc.
- **Dataset/platform:** [ReFED Food Waste Monitor](https://insights-engine.refed.org/food-waste-monitor)
- **Indicator:** modeled retail food surplus, tons/year, US national annual series
- **Edition:** API metadata updated 2026-03-25
- **Accessed:** 19 July 2026
- **Methodology:** [Retail Food Waste Monitor methodology](https://docs.refed.org/methodologies/food_waste_monitor/retail.html)
- **Terms:** [ReFED Terms of Use](https://refed.org/terms-of-use/)

ReFED and source-licensor notices and disclaimers remain in force. This distribution uses the data for food-waste-related informational, research, policy, and other non-commercial purposes with conspicuous attribution. Other or commercial use requires permission. Attribution does not imply ReFED endorsement.

### Portland and geometry sources

- [USDA Food Access Research Atlas](https://www.ers.usda.gov/data-products/food-access-research-atlas/) — census-tract food-access indicators
- [OpenStreetMap](https://www.openstreetmap.org/) — food-establishment locations
- [Natural Earth](https://www.naturalearthdata.com/) — global boundary geometries

The interactive basemap is provided by CARTO/OpenStreetMap. MapLibre GL JS and PMTiles browser libraries load from version-pinned public CDN URLs; thematic PMTiles data are shipped locally.

## Software license

Software code is available under the MIT License in `LICENSE`. Source data remain subject to the separate terms above.
