// src/stats.js
// User-friendly generic stats UI (Chart.js)
// - sensible defaults
// - hides date dims by default
// - metric shown only when needed
// - disables sum/avg/min/max when a table has no numeric metrics
// - clears stale chart/table on invalid state or errors
// - top N + "Other" bucket for pie/doughnut
// - FK group labels resolved via /api/<refTable>
// - prevents "stale response" race conditions with a run token
// - NEW: toggleable ID display for FK labels (Név (#15))
// - NEW: smarter FK label picking; avoids date-like labels (e.g. felev) and can fall back to 1-hop FK label (e.g. kursus -> tantargy.nev)

import Chart from "chart.js/auto";

let chartInstance = null;

async function apiGetJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isIdLike(name) {
  const lower = String(name || "").toLowerCase();
  return (
    lower === "id" ||
    lower.endsWith("_id") ||
    (lower.endsWith("id") && lower.length <= 4)
  );
}

function isDateLike(typeStr) {
  const t = String(typeStr || "").toUpperCase();
  // Sequelize key: DATE, DATEONLY
  return t.includes("DATE");
}

function looksDateishValue(v) {
  if (v === null || v === undefined) return false;
  const s = String(v);

  // ISO datetime/date
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return true;

  // "academic-like" / date-like patterns such as 2024-25-2 or 2024-09-2 etc.
  if (/^\d{4}-\d{2}-\d{1,2}$/.test(s)) return true;

  // other common date-ish
  if (/^\d{4}\/\d{2}\/\d{2}/.test(s)) return true;
  if (/^\d{2}\.\d{2}\.\d{2,4}\.?$/.test(s)) return true;

  return false;
}

function normalizeAggValue(v) {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function formatDateishLabel(v) {
  if (v === null || v === undefined || v === "") return "(NULL)";
  const s = String(v);

  // ISO DATETIME
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString("hu-HU");
  }
  // DATEONLY
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + "T00:00:00");
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("hu-HU");
  }

  return s;
}

function buildStatsLayout(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2>Statisztikák</h2>
        <button class="btn secondary" id="stats-refresh">Meta frissítés</button>
      </div>

      <div class="stats-toolbar">
        <label>
          Tábla:
          <select id="stats-table"></select>
        </label>

        <label>
          Csoportosítás:
          <select id="stats-dim"></select>
        </label>

        <label>
          Aggregálás:
          <select id="stats-agg">
            <option value="count">count</option>
            <option value="sum">sum</option>
            <option value="avg">avg</option>
            <option value="min">min</option>
            <option value="max">max</option>
          </select>
        </label>

        <label id="stats-metric-wrap">
          Metrika:
          <select id="stats-metric"></select>
        </label>

        <label>
          Diagram:
          <select id="stats-chart-type">
            <option value="auto">Auto</option>
            <option value="bar">Oszlop</option>
            <option value="doughnut">Gyűrű</option>
            <option value="pie">Kör</option>
          </select>
        </label>

        <label>
          Top:
          <select id="stats-topn">
            <option value="5">5</option>
            <option value="10" selected>10</option>
            <option value="15">15</option>
            <option value="20">20</option>
            <option value="all">Összes</option>
          </select>
        </label>

        <label class="inline" title="Kör/gyűrű diagramnál a top után a maradék összevonása 'Egyéb'-be">
          <input type="checkbox" id="stats-collapse-other" checked />
          Egyéb összevonás
        </label>

        <label class="inline">
          <input type="checkbox" id="stats-exclude-null" checked />
          NULL kihagyása
        </label>

        <label class="inline" title="Alapból rejtjük a dátum mezőket, mert könnyű nagyon sok kategóriát generálni (pl. felvet_datum)">
          <input type="checkbox" id="stats-show-dates" />
          Dátum mezők
        </label>

        <label class="inline" title="FK csoportosításnál a név mellett az ID is megjelenik (pl. Név (#15))">
          <input type="checkbox" id="stats-show-ids" checked />
          ID megjelenítése
        </label>

        <button class="btn primary" id="stats-run">Lekérdezés</button>

        <div id="stats-error" class="error hidden"></div>
      </div>

      <div class="stats-body">
        <div class="stats-chart-wrapper">
          <canvas id="stats-chart"></canvas>
        </div>

        <div class="stats-table">
          <table class="data-table">
            <thead>
              <tr><th>Csoport</th><th>Érték</th></tr>
            </thead>
            <tbody id="stats-tbody">
              <tr><td colspan="2">Nincs adat.</td></tr>
            </tbody>
          </table>
        </div>

        <div class="stats-raw" id="stats-hint" style="display:none;"></div>
      </div>
    </div>
  `;
}

function setStatsError(msg) {
  const el = document.getElementById("stats-error");
  if (!el) return;
  if (!msg) {
    el.classList.add("hidden");
    el.textContent = "";
  } else {
    el.classList.remove("hidden");
    el.textContent = msg;
  }
}

function setHint(msg) {
  const el = document.getElementById("stats-hint");
  if (!el) return;
  if (!msg) {
    el.style.display = "none";
    el.textContent = "";
  } else {
    el.style.display = "block";
    el.textContent = msg;
  }
}

function fillSelect(selectEl, items, getValue, getLabel) {
  if (!selectEl) return;
  selectEl.innerHTML = (items || [])
    .map((it) => `<option value="${escapeHtml(getValue(it))}">${escapeHtml(getLabel(it))}</option>`)
    .join("");
}

function renderTable(rows) {
  const tbody = document.getElementById("stats-tbody");
  if (!tbody) return;

  if (!Array.isArray(rows) || !rows.length) {
    tbody.innerHTML = `<tr><td colspan="2">Nincs adat.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map((r) => `<tr><td>${escapeHtml(r.label)}</td><td>${escapeHtml(r.valueDisplay ?? r.value)}</td></tr>`)
    .join("");
}

function tooltipLabelWithPercent(ctx) {
  const label = ctx.label ?? "";
  const val = normalizeAggValue(ctx.parsed);
  const data = Array.isArray(ctx.dataset?.data) ? ctx.dataset.data : [];
  const total = data.reduce((a, b) => a + normalizeAggValue(b), 0);
  const pct = total > 0 ? ((val / total) * 100).toFixed(1) : "0.0";
  return `${label}: ${val} (${pct}%)`;
}

function chooseChartTypeAuto(count) {
  // kevés kategória -> doughnut, sok -> bar
  if (count <= 8) return "doughnut";
  return "bar";
}

function renderChart(chartRef, chartType, rows) {
  const canvas = document.getElementById("stats-chart");
  if (!canvas || typeof Chart === "undefined") return chartRef;

  const labels = (rows || []).map((r) => r.label);
  const values = (rows || []).map((r) => normalizeAggValue(r.value));

  const finalType = chartType === "auto" ? chooseChartTypeAuto(labels.length) : chartType;

  if (chartRef) chartRef.destroy();

  chartRef = new Chart(canvas, {
    type: finalType,
    data: {
      labels,
      datasets: [{ label: "Érték", data: values }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: finalType === "pie" || finalType === "doughnut"
              ? tooltipLabelWithPercent
              : undefined,
          },
        },
      },
      scales: finalType === "bar" ? { y: { beginAtZero: true } } : {},
    },
  });

  return chartRef;
}

async function loadMeta(apiBase) {
  return apiGetJson(`${apiBase}/meta`);
}

function getTableMeta(meta, tableName) {
  const tables = meta?.tables || [];
  return tables.find((t) => t.table === tableName || t.modelKey === tableName || t.label === tableName);
}

function getColumnMeta(tmeta, colName) {
  const cols = tmeta?.columns || [];
  return cols.find((c) => c.name === colName);
}

async function runAggregate(apiBase, table, groupBy, agg, field, excludeNull) {
  const url = new URL(`${apiBase}/stats/aggregate`);
  url.searchParams.set("table", table);
  url.searchParams.set("groupBy", groupBy);
  url.searchParams.set("agg", agg);
  if (field) url.searchParams.set("field", field);
  if (excludeNull) url.searchParams.set("excludeNull", "1");
  return apiGetJson(url.toString());
}

// FK label cache: refTable -> { keyField, labelField, map }
const FK_LABEL_CACHE = new Map();

// pick label fields from a table meta
function pickLabelFieldForTable(tmeta) {
  const cols = tmeta?.columns || [];

  // strong preferred names first
  const preferred = [
    "nev", "name", "megnevezes", "megnevezés", "cim", "title",
    "kod", "kód", "neptun",
    "targy", "tantargy", "kurzusnev", "kurzus_nev"
  ];

  const byName = preferred.find((p) => cols.some((c) => String(c.name).toLowerCase() === p));
  if (byName) return cols.find((c) => String(c.name).toLowerCase() === byName)?.name;

  // first non-id-like text-like, but avoid DATE-typed or "datum/date/time" named columns
  const textLike = cols.find((c) => {
    const n = String(c.name || "");
    const lower = n.toLowerCase();
    if (isIdLike(n)) return false;
    if (isDateLike(c.type)) return false;
    if (lower.includes("datum") || lower.includes("date") || lower.includes("time")) return false;

    const t = String(c.type || "").toUpperCase();
    return t.includes("CHAR") || t.includes("TEXT") || t.includes("STRING") || t.includes("ENUM");
  });
  if (textLike) return textLike.name;

  // fallback: first non-idlike
  const any = cols.find((c) => !isIdLike(c.name));
  return any ? any.name : (cols[0]?.name || "id");
}

function pickKeyFieldForTable(tmeta) {
  const cols = tmeta?.columns || [];
  const pk = cols.find((c) => c.primaryKey);
  return pk ? pk.name : "id";
}

function scoreFkCandidate(fkColMeta) {
  const n = String(fkColMeta?.name || "").toLowerCase();
  let score = 0;
  // heuristics for common domain tables
  if (n.includes("tantargy")) score += 5;
  if (n.includes("targy")) score += 4;
  if (n.includes("kurzus")) score += 3;
  if (n.includes("tanar")) score += 3;
  if (n.includes("hallgato")) score += 2;
  return score;
}

// Try to choose an FK column on ref table to produce a better label
function pickBestFkLabelSource(meta, refMeta) {
  const cols = refMeta?.columns || [];
  const fkCols = cols.filter((c) => c?.references?.model);
  if (!fkCols.length) return null;

  const strongLabelNames = new Set(["nev", "name", "megnevezes", "megnevezés", "title", "kod", "kód", "neptun"]);

  let best = null;
  let bestScore = -1;

  for (const fk of fkCols) {
    const refTable = fk.references.model;
    if (!refTable) continue;

    const targetMeta = getTableMeta(meta, refTable);
    if (!targetMeta) continue;

    const targetLabel = pickLabelFieldForTable(targetMeta);
    if (!targetLabel) continue;

    let s = 0;
    s += scoreFkCandidate(fk);
    const tl = String(targetLabel).toLowerCase();
    if (strongLabelNames.has(tl)) s += 4;
    if (!isIdLike(targetLabel)) s += 1;
    if (!isDateLike(getColumnMeta(targetMeta, targetLabel)?.type)) s += 1;

    if (s > bestScore) {
      bestScore = s;
      best = { fkCol: fk.name, targetTable: refTable };
    }
  }

  return best;
}

async function ensureFkLabelMap(apiBase, meta, refTable, visited) {
  if (FK_LABEL_CACHE.has(refTable)) return FK_LABEL_CACHE.get(refTable);

  visited = visited || new Set();
  if (visited.has(refTable)) return null;
  visited.add(refTable);

  const refMeta = getTableMeta(meta, refTable);
  if (!refMeta) return null;

  const keyField = pickKeyFieldForTable(refMeta);
  let labelField = pickLabelFieldForTable(refMeta);

  // fetch ref rows
  const url = new URL(`${apiBase}/${refTable}`);
  url.searchParams.set("limit", "5000");
  const rows = await apiGetJson(url.toString());

  // Build initial label map from labelField
  const map = new Map();

  const getRawLabel = (row) => {
    if (!row) return null;
    const v = row[labelField];
    return v === undefined ? null : v;
  };

  // Evaluate if chosen label seems "date-ish" based on sample values
  let sample = [];
  for (const r of rows || []) {
    const v = getRawLabel(r);
    if (v === null || v === undefined || v === "") continue;
    sample.push(v);
    if (sample.length >= 40) break;
  }
  const dateishRatio =
    sample.length > 0
      ? sample.filter(looksDateishValue).length / sample.length
      : 0;

  // If label looks too date-like, try 1-hop FK label fallback (e.g. kursus -> tantargy.nev)
  let fkFallback = null;
  if (dateishRatio >= 0.5) {
    fkFallback = pickBestFkLabelSource(meta, refMeta);
  }

  let fkTargetMapInfo = null;
  if (fkFallback) {
    try {
      fkTargetMapInfo = await ensureFkLabelMap(apiBase, meta, fkFallback.targetTable, new Set(visited));
    } catch (e) {
      fkTargetMapInfo = null;
    }
  }

  for (const r of rows || []) {
    const key = r?.[keyField];
    if (key === undefined || key === null) continue;

    let label = null;

    // Preferred: FK fallback label (if available)
    if (fkFallback && fkTargetMapInfo) {
      const fkVal = r?.[fkFallback.fkCol];
      if (fkVal !== undefined && fkVal !== null && fkVal !== "") {
        const nice = fkTargetMapInfo.map.get(String(fkVal));
        if (nice) label = nice;
      }
    }

    // Otherwise: chosen labelField
    if (label == null) {
      const raw = getRawLabel(r);
      if (raw !== null && raw !== undefined && raw !== "") label = String(raw);
    }

    // Final fallback: key itself
    if (label == null || label === "") label = String(key);

    map.set(String(key), label);
  }

  const info = { keyField, labelField, map };
  FK_LABEL_CACHE.set(refTable, info);
  return info;
}

export async function initStatsUI(cfg) {
  const container = document.getElementById(cfg.containerId);
  if (!container) return;

  buildStatsLayout(container);

  const apiBase = cfg.apiBase || "";

  let meta = null;
  let chartRef = null;
  let runToken = 0;

  const tableSel = document.getElementById("stats-table");
  const dimSel = document.getElementById("stats-dim");
  const metricSel = document.getElementById("stats-metric");
  const metricWrap = document.getElementById("stats-metric-wrap");
  const aggSel = document.getElementById("stats-agg");
  const excludeNullEl = document.getElementById("stats-exclude-null");
  const chartTypeSel = document.getElementById("stats-chart-type");
  const topNEl = document.getElementById("stats-topn");
  const collapseOtherEl = document.getElementById("stats-collapse-other");
  const showDatesEl = document.getElementById("stats-show-dates");
  const showIdsEl = document.getElementById("stats-show-ids");

  function clearResults() {
    renderTable([]);
    if (chartRef) {
      chartRef.destroy();
      chartRef = null;
    }
  }

  function preferredDimPick(dims) {
    const preferred = ["szak", "jegy", "tipus", "felev", "nem", "evfolyam"];
    const hit = preferred.find((d) => dims.includes(d));
    if (hit) return hit;

    // első nem-idlike
    const safe = dims.find((d) => !isIdLike(d));
    return safe || dims[0];
  }

  function updateMetricVisibility() {
    const agg = aggSel?.value || "count";
    const needMetric = agg !== "count";
    if (metricWrap) metricWrap.style.display = needMetric ? "" : "none";
  }

  // Ha nincs numerikus metrika a táblához, akkor ne lehessen sum/avg/min/max-ot választani
  function updateAggAvailability(metrics) {
    if (!aggSel) return;
    const hasMetrics = Array.isArray(metrics) && metrics.length > 0;

    for (const opt of Array.from(aggSel.options || [])) {
      if (opt.value !== "count") opt.disabled = !hasMetrics;
    }

    // ha most épp egy tiltott agg van kiválasztva, álljunk vissza count-ra
    if (!hasMetrics && aggSel.value !== "count") {
      aggSel.value = "count";
      setStatsError("Ehhez a táblához nincs numerikus metrika, ezért csak a count érhető el.");
      setHint("");
      clearResults();
    }

    updateMetricVisibility();
  }

  function rebuildDimAndMetricLists() {
    if (!meta) return;
    const tableName = tableSel?.value;
    const tmeta = getTableMeta(meta, tableName);
    if (!tmeta) return;

    const dimsRaw = Array.isArray(tmeta.dimensions) ? tmeta.dimensions.slice() : [];
    const metrics = Array.isArray(tmeta.metrics) ? tmeta.metrics.slice() : [];

    // ha a user nem kéri, a DATE/DATEONLY dimenziókat elrejtjük
    const showDates = !!showDatesEl?.checked;
    const dims = dimsRaw.filter((d) => {
      const cmeta = getColumnMeta(tmeta, d);
      if (!cmeta) return true;
      if (!showDates && isDateLike(cmeta.type)) return false;
      return true;
    });

    fillSelect(dimSel, dims, (x) => x, (x) => x);
    fillSelect(metricSel, metrics, (x) => x, (x) => x);

    updateAggAvailability(metrics);

    // értelmes default dim
    const pick = preferredDimPick(dims);
    if (pick) dimSel.value = pick;

    // ha nincs metrika, üresen hagyjuk (count-hoz úgysem kell)
    if (!metrics.length) metricSel.innerHTML = "";
  }

  async function refreshMeta() {
    try {
      setStatsError("");
      setHint("");
      meta = await loadMeta(apiBase);

      const tables = meta?.tables || [];
      fillSelect(tableSel, tables, (t) => t.table, (t) => t.label || t.table);

      if (tables.some((t) => t.table === "hallgato")) tableSel.value = "hallgato";

      rebuildDimAndMetricLists();
      updateMetricVisibility();
    } catch (e) {
      console.error(e);
      setStatsError("Meta betöltés sikertelen.");
      clearResults();
    }
  }

  function applyTopNAndOther(rows, topN, collapseOther, chartType) {
    if (!Array.isArray(rows)) return [];

    const isRound = (chartType === "pie" || chartType === "doughnut");

    if (topN === "all") return rows;

    const n = Number(topN);
    if (!Number.isFinite(n) || n <= 0) return rows;

    if (rows.length <= n) return rows;

    const head = rows.slice(0, n);
    const tail = rows.slice(n);

    if (collapseOther && isRound) {
      const otherSum = tail.reduce((a, r) => a + normalizeAggValue(r.value), 0);
      if (otherSum > 0) {
        head.push({ label: "Egyéb", value: otherSum, valueDisplay: String(otherSum) });
      }
      return head;
    }

    return head;
  }

  function sortRowsByAgg(rows, agg) {
    const arr = (rows || []).slice();

    // NULL értékek a végére
    const withKey = arr.map((r) => ({
      r,
      isNull: (r.valueDisplay === "(NULL)"),
      v: normalizeAggValue(r.value),
    }));

    // min: ASC, minden más: DESC
    const dir = (agg === "min") ? 1 : -1;

    withKey.sort((a, b) => {
      if (a.isNull && !b.isNull) return 1;
      if (!a.isNull && b.isNull) return -1;
      if (a.v === b.v) return 0;
      return (a.v < b.v ? -1 : 1) * dir;
    });

    return withKey.map(x => x.r);
  }

  async function onRun() {
    const myToken = ++runToken;

    try {
      setStatsError("");
      setHint("");

      const table = tableSel?.value;
      const groupBy = dimSel?.value;
      const agg = aggSel?.value || "count";
      const chartType = chartTypeSel?.value || "auto";
      const excludeNull = !!excludeNullEl?.checked;
      const topN = topNEl?.value || "10";
      const collapseOther = !!collapseOtherEl?.checked;

      if (!table || !groupBy) {
        setStatsError("Válassz táblát és csoportosítást.");
        clearResults();
        return;
      }

      let field = metricSel?.value || "";
      if (agg === "count") field = "";

      // ha nem count, de nincs metrika lehetőség, álljunk vissza
      if (agg !== "count" && (!metricSel || !metricSel.options || metricSel.options.length === 0)) {
        setStatsError("Ehhez a táblához nincs numerikus metrika, visszaállítottam count-ra.");
        aggSel.value = "count";
        updateMetricVisibility();
        clearResults();
        return;
      }

      // ha nem count és üres field, akkor válasszuk az első metrikát (kényelmi)
      if (agg !== "count" && !field) {
        const first = metricSel?.options?.[0]?.value;
        if (first) {
          metricSel.value = first;
          field = first;
        }
      }

      if (agg !== "count" && !field) {
        setStatsError("Sum/avg/min/max esetén válassz metrikát.");
        clearResults();
        return;
      }

      const rows = await runAggregate(apiBase, table, groupBy, agg, field, excludeNull);

      // ha közben újabb futás indult, ezt dobjuk
      if (myToken !== runToken) return;

      const tmeta = getTableMeta(meta, table);
      const gcol = getColumnMeta(tmeta, groupBy);

      // FK label resolve
      let labelMap = null;
      if (gcol?.references?.model) {
        try {
          labelMap = await ensureFkLabelMap(apiBase, meta, gcol.references.model);
        } catch (e) {
          console.warn("FK label map load failed:", e);
        }
      }

      const showIds = !!showIdsEl?.checked;

      const mapped = (rows || []).map((r) => {
        const rawGrp = r.grp;
        let label = formatDateishLabel(rawGrp);

        if (labelMap && rawGrp !== null && rawGrp !== undefined && rawGrp !== "") {
          const k = String(rawGrp);
          const nice = labelMap.map.get(k);
          if (nice) label = showIds ? `${nice} (#${k})` : `${nice}`;
        }

        const rawVal = r.value;
        const valueDisplay = (rawVal === null || rawVal === undefined) ? "(NULL)" : String(rawVal);

        return { label, value: normalizeAggValue(rawVal), valueDisplay };
      });

      const sorted = sortRowsByAgg(mapped, agg);

      const effectiveChartType = chartType === "auto" ? chooseChartTypeAuto(sorted.length) : chartType;
      const finalRows = applyTopNAndOther(sorted, topN, collapseOther, effectiveChartType);

      if (sorted.length > 25 && (effectiveChartType === "pie" || effectiveChartType === "doughnut")) {
        setHint("Sok kategória esetén a kör/gyűrű diagram nehezen olvasható. Használd a Top értéket vagy válts Oszlop diagramra.");
      } else if (sorted.length > 25 && effectiveChartType === "bar") {
        setHint("Sok kategória esetén érdemes a Top értéket 10–15-re állítani.");
      }

      renderTable(finalRows);
      chartRef = renderChart(chartRef, chartType, finalRows);
    } catch (e) {
      console.error(e);
      setStatsError("Lekérdezés sikertelen.");
      setHint("");
      clearResults();
    }
  }

  // events
  document.getElementById("stats-refresh")?.addEventListener("click", refreshMeta);

  const debounce = (() => {
    let t = null;
    return (fn) => {
      clearTimeout(t);
      t = setTimeout(fn, 150);
    };
  })();

  tableSel?.addEventListener("change", () => {
    setStatsError("");
    setHint("");
    rebuildDimAndMetricLists();
    debounce(onRun);
  });

  dimSel?.addEventListener("change", () => debounce(onRun));

  aggSel?.addEventListener("change", () => {
    updateMetricVisibility();

    // ha a user mégis olyan agg-ra vált, amihez nincs metrika (race/meta késés esetén)
    if (aggSel.value !== "count" && (!metricSel || !metricSel.options || metricSel.options.length === 0)) {
      setStatsError("Ehhez a táblához nincs numerikus metrika, visszaállítottam count-ra.");
      aggSel.value = "count";
      updateMetricVisibility();
      setHint("");
      clearResults();
      return;
    }

    debounce(onRun);
  });

  metricSel?.addEventListener("change", () => debounce(onRun));
  excludeNullEl?.addEventListener("change", () => debounce(onRun));
  chartTypeSel?.addEventListener("change", () => debounce(onRun));
  topNEl?.addEventListener("change", () => debounce(onRun));
  collapseOtherEl?.addEventListener("change", () => debounce(onRun));

  showDatesEl?.addEventListener("change", () => {
    rebuildDimAndMetricLists();
    debounce(onRun);
  });

  showIdsEl?.addEventListener("change", () => debounce(onRun));

  document.getElementById("stats-run")?.addEventListener("click", onRun);

  await refreshMeta();
  debounce(onRun);
}
