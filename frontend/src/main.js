// src/main.js
import "./style.css";
import { initStatsUI } from "./stats.js";

const API_BASE = "http://localhost:3000/api";

// --- Helper: ID-szerű mezők felismerése ---
function isIdLike(name) {
  if (!name) return false;
  const lower = String(name).toLowerCase();
  return (
    lower === "id" ||
    lower.endsWith("_id") ||
    (lower.endsWith("id") && lower.length <= 4)
  );
}

function humanizeName(name) {
  if (!name) return "";
  return String(name)
    .replace(/^v_/, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapeHtml(v) {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toDateInputValue(raw) {
  if (!raw) return "";
  // "2024-09-10"
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // ISO: "2024-09-10T10:00:00.000Z"
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toDateTimeLocalValue(raw) {
  if (!raw) return "";
  // már jó formátum: "YYYY-MM-DDTHH:mm"
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return raw;

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function formatCellValue(cfg, fieldName, raw) {
  if (raw === null || raw === undefined) return "";

  // FK → label (field.options alapján)
  const field = (cfg.fields || []).find((f) => f.name === fieldName);
  if (field?.fk && Array.isArray(field.options)) {
    const opt = field.options.find((o) => String(o.value) === String(raw));
    if (opt?.label != null) return String(opt.label);
  }

  // dátum/datetime szebb megjelenítés
  if (typeof raw === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return d.toLocaleString("hu-HU");
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const d = new Date(raw + "T00:00:00");
      if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("hu-HU");
    }
  }

  return String(raw);
}


// Ha a filter FK oszlopra megy, akkor a user által beírt LABEL-t (pl. "Kiss")
// próbáljuk visszafejteni a hozzá tartozó ID(k)-ra. Így a szűrés úgy működik,
// ahogy a listában is látja a felhasználó.
function normalizeFilterForColumn(cfg, col, op, val) {
  const raw = String(val ?? "").trim();
  if (!raw) return null;

  const field = (cfg.fields || []).find((f) => f.name === col);

  // --- Dátum / datetime normalizálás a backend felé ---
  // DATE: csak YYYY-MM-DD
  if (field?.type === "date") {
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      return { col, op, val: raw.slice(0, 10) };
    }
  }

  // DATETIME: datetime-local ("YYYY-MM-DDTHH:mm") -> "YYYY-MM-DD HH:mm:00"
  if (field?.type === "datetime-local") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
      return { col, op, val: raw.replace("T", " ") + ":00" };
    }
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(raw)) {
      return { col, op, val: raw + ":00" };
    }
    // ha már "YYYY-MM-DD HH:mm:ss" vagy hasonló, küldjük úgy ahogy van
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      return { col, op, val: raw };
    }
  }

  // --- FK mezők: ha a user labelt gépel, alakítsuk value-vá ---
  // (ha <select>-tel szűrsz, akkor raw már eleve ID lesz)
  if (field?.fk && Array.isArray(field.options) && field.options.length) {
    const looksNumeric = /^-?\d+(\.\d+)?$/.test(raw);
    if (looksNumeric) return { col, op, val: raw };

    const q = raw.toLowerCase();
    const exact = field.options.find((o) => String(o.label ?? "").toLowerCase() === q);
    if (exact) return { col, op, val: String(exact.value) };

    // "Kiss Balázs (#1)" jellegű labelből az ID-t ki tudjuk szedni
    const m = raw.match(/\(#(\d+)\)\s*$/);
    if (m) return { col, op, val: m[1] };

    // részleges egyezésnél ne tippeljünk - hagyjuk a raw-t (backend majd kezeli/eldobja)
    return { col, op, val: raw };
  }

  return { col, op, val: raw };
}


function formatGroupLabel(value) {
  if (value === null || value === undefined || value === "") return "(NULL)";
  const s = String(value);

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString("hu-HU");
  }
  return s;
}

function mapColumnToField(col) {
  const t = String(col.type || "").toUpperCase();

  let type = "text";
  if (t === "BOOLEAN" || /TINYINT\(1\)/.test(t)) type = "checkbox";
  else if (/INT|DECIMAL|NUMERIC|FLOAT|DOUBLE/.test(t)) type = "number";
  else if (/DATETIME|TIMESTAMP/.test(t)) type = "datetime-local";
  else if (/DATE/.test(t)) type = "date";
  else if (String(col.name || "").toLowerCase().includes("email")) type = "email";

  const required = !col.allowNull;

  return {
    name: col.name,
    label: humanizeName(col.name) + (required ? "*" : ""),
    type,
    required,
  };
}

// --- API helper-ek ---
async function apiGet(path, params = {}) {
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

async function apiPut(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

async function apiDelete(path) {
  const res = await fetch(API_BASE + path, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    throw data;
  }
}

// --- Dinamikus ENTITIES + state ---
let ENTITIES = {};
let entityState = {};

// FK cache: table -> { rows, key, labelField, labelMap }
const FK_CACHE = {
  tables: new Map(),
};

// --- Layout: tabok + nézetek ---
function renderLayout() {
  const app = document.querySelector("#app");
  if (!app) return;

  const entityTabs = Object.entries(ENTITIES)
    .map(
      ([key, cfg], idx) =>
        `<button data-view="${key}" class="tab ${idx === 0 ? "active" : ""}">${cfg.title}</button>`
    )
    .join("");

  const entityViews = Object.keys(ENTITIES)
    .map((key, idx) => `<section id="view-${key}" class="view ${idx === 0 ? "" : "hidden"}"></section>`)
    .join("");

  const firstEntityKey = Object.keys(ENTITIES)[0];
  const firstEntityTitle = ENTITIES[firstEntityKey]?.title || "CRUD";
  const appTitle = `Generált alkalmazás – ${firstEntityTitle}`;

  app.innerHTML = `
    <div class="app">
      <header class="topbar">
        <h1 id="app-title">${escapeHtml(appTitle)}</h1>
        <span class="env-badge">API: ${API_BASE}</span>
      </header>

      <nav class="tabs">
        ${entityTabs}
        <button data-view="stats" class="tab">Statisztikák</button>
      </nav>

      <main class="content">
        ${entityViews}
        <section id="view-stats" class="view hidden"></section>
      </main>
    </div>
  `;

  app.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      app.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const view = btn.dataset.view;
      app.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
      const target =
        view === "stats"
          ? document.querySelector("#view-stats")
          : document.querySelector(`#view-${view}`);
      if (target) target.classList.remove("hidden");
      const titleEl = document.querySelector("#app-title");
      if (titleEl) {
      const title =
        view === "stats"
          ? "Statisztikák"
          : ENTITIES[view]?.title || "CRUD";

      titleEl.textContent = `Generált alkalmazás – ${title}`;
    }
    });
  });
}

// --- Meta + FK label heuristics ---
function guessLabelField(tableMeta) {
  if (!tableMeta || !Array.isArray(tableMeta.columns)) return null;
  const cols = tableMeta.columns;

  const nameLike = cols.find((c) => /nev|name|title|megnevezes|kod|code/i.test(c.name || ""));
  if (nameLike && !isIdLike(nameLike.name)) return nameLike.name;

  const textLike = cols.find(
    (c) => !isIdLike(c.name) && /STRING|CHAR|TEXT|ENUM/i.test(String(c.type || ""))
  );
  if (textLike) return textLike.name;

  const anyNonId = cols.find((c) => !isIdLike(c.name));
  return anyNonId ? anyNonId.name : null;
}

async function fetchMeta() {
  const res = await fetch(`${API_BASE}/meta`);
  if (!res.ok) throw new Error(`Meta lekérés sikertelen: ${res.status}`);
  return res.json();
}

function buildEntitiesFromMeta(meta) {
  const entities = {};
  const tables = meta.tables || [];

  function findTableMetaForRef(refModel) {
    return tables.find(
      (tt) =>
        tt.table === refModel ||
        tt.modelKey === refModel ||
        (tt.label && tt.label === refModel)
    );
  }

  for (const t of tables) {
    const key = t.table;

    const pkCols = (t.columns || []).filter((c) => c.primaryKey);
    const pkFields = pkCols.map((c) => c.name);
    const isCompositePk = pkFields.length > 1;

    const idField = pkFields.length === 1 ? pkFields[0] : null;

    // LISTA oszlopok: FK-kat is mutatjuk, de felirat legyen emberibb (Hallgató/Kurzus)
    const listColumns = (t.columns || [])
      .filter((c) => (c.references && c.references.model) || !isIdLike(c.name))
      .slice(0, 6)
      .map((c) => {
        if (c.references && c.references.model) {
          const refMeta = findTableMetaForRef(c.references.model);
          return {
            field: c.name,
            label: humanizeName(refMeta?.label || refMeta?.table || c.name.replace(/_id$/i, "")),
          };
        }
        return { field: c.name, label: humanizeName(c.name) };
      });

    const fields = [];
    for (const col of t.columns || []) {
      if (col.primaryKey && !isCompositePk) continue;

      const field = mapColumnToField(col);

      // FK -> select
      if (col.references && col.references.model) {
        const refMeta = findTableMetaForRef(col.references.model);
        const labelField = guessLabelField(refMeta);

        const refPk =
          (refMeta?.columns || []).find((c) => c.primaryKey)?.name ||
          col.references.key ||
          "id";

        field.type = "select";
        field.fk = {
          table: refMeta?.table || col.references.model,
          api: `/${refMeta?.table || col.references.model}`,
          key: refPk,
          labelField,
        };

        // szebb mezőnév (ne "Hallgato Id*", hanem "Hallgató*")
        const nice = humanizeName(refMeta?.label || refMeta?.table || col.name.replace(/_id$/i, ""));
        field.label = nice + (field.required ? "*" : "");
      }

      // ENUM -> select
      if (Array.isArray(col.enumValues) && col.enumValues.length) {
        field.type = "select";
        field.options = [
          ...(field.required
            ? [{ value: "", label: "-- válassz --", _placeholder: true }]
            : []),
          ...col.enumValues.map((v) => ({
            value: v,
            label: humanizeName(String(v)),
          })),
        ];
      }

      fields.push(field);
    }

    entities[key] = {
      api: `/${t.table}`,
      title: humanizeName(t.label || t.table),
      singular: humanizeName(t.label || t.table).toLowerCase(),
      idField,
      pkFields,
      listColumns,
      fields,
    };
  }

  return entities;
}

// --- PK helpers (single + composite) ---
function pkKeyFromRow(cfg, row) {
  return (cfg.pkFields || [cfg.idField || "id"]).map((f) => row?.[f]).join("|");
}

function pkValuesFromKey(pkKey) {
  return String(pkKey).split("|");
}

function pkPathFromKey(pkKey) {
  const vals = pkValuesFromKey(pkKey);
  return "/" + vals.map((v) => encodeURIComponent(v)).join("/");
}

function findRowByPkKey(cfg, rows, pkKey) {
  const vals = pkValuesFromKey(pkKey);
  const fields = cfg.pkFields || [cfg.idField || "id"];
  return rows.find((r) => fields.every((f, i) => String(r[f]) === String(vals[i])));
}

function initEntityState() {
  entityState = {};
  for (const key of Object.keys(ENTITIES)) {
    entityState[key] = { rows: [], currentEdit: null, filters: [] };
  }
}

/**
 * Options generálás úgy, hogy ID-t csak akkor fűzünk hozzá,
 * ha a base label duplikált.
 */
function makeOptionsWithDisambiguation(rows, valueKey, baseLabelFn, required) {
  const baseLabels = rows.map((r) => {
    const v = baseLabelFn(r);
    return v === null || v === undefined || v === "" ? "" : String(v);
  });

  const counts = new Map();
  for (const l of baseLabels) counts.set(l, (counts.get(l) || 0) + 1);

  const opts = [];

  // required selectnél ne legyen auto-kiválasztás: tegyünk be placeholder-t
  if (required) {
    opts.push({ value: "", label: "-- válassz --", _placeholder: true });
  } else {
    opts.push({ value: "", label: "(nincs)", _placeholder: true });
  }

  rows.forEach((row, idx) => {
    const value = row?.[valueKey];
    const base = baseLabels[idx] || String(value ?? "");
    const label = counts.get(base) > 1 ? `${base} (#${value})` : base;
    opts.push({ value, label });
  });

  return opts;
}

// FK mezők options feltöltése a kapcsolt táblákból (először cache-eljük a táblákat)
async function enrichEntitiesWithFkOptions() {
  // 1) összegyűjtjük a szükséges FK táblákat
  const needed = new Map(); // table -> { api, key, labelField }
  for (const cfg of Object.values(ENTITIES)) {
    for (const field of cfg.fields || []) {
      if (!field.fk) continue;
      if (!needed.has(field.fk.table)) {
        needed.set(field.fk.table, {
          api: field.fk.api,
          key: field.fk.key,
          labelField: field.fk.labelField,
        });
      }
    }
  }

  // 2) betöltjük őket (cache)
  for (const [table, info] of needed.entries()) {
    try {
      const rows = await apiGet(info.api, { limit: 1000, offset: 0 });
      const labelMap = new Map();
      for (const r of rows) {
        const id = r?.[info.key];
        const labelVal = info.labelField ? r?.[info.labelField] : id;
        labelMap.set(String(id), String(labelVal ?? id));
      }
      FK_CACHE.tables.set(table, { ...info, rows, labelMap });
    } catch (e) {
      console.error("FK tábla betöltése sikertelen:", table, e);
      FK_CACHE.tables.set(table, { ...info, rows: [], labelMap: new Map() });
    }
  }

  // 3) felépítjük az options-okat minden FK fieldhez
  for (const [entityKey, cfg] of Object.entries(ENTITIES)) {
    for (const field of cfg.fields) {
      if (!field.fk) continue;

      const fkInfo = FK_CACHE.tables.get(field.fk.table);
      const rows = fkInfo?.rows || [];

      // Kurzus label: felev · tipus · tantargyNev · tanarNev (ha vannak)
      if (field.fk.table === "kurzus") {
        const tantMap = FK_CACHE.tables.get("tantargy")?.labelMap;
        const tanMap = FK_CACHE.tables.get("tanar")?.labelMap;

        const baseLabelFn = (r) => {
          const parts = [];

          if (r?.felev) parts.push(String(r.felev));
          if (r?.tipus) parts.push(String(r.tipus).replace(/_/g, " "));
          if (r?.tantargy_id != null) {
            const tLabel = tantMap?.get(String(r.tantargy_id));
            parts.push(tLabel ? String(tLabel) : `Tantárgy #${r.tantargy_id}`);
          }
          if (r?.tanar_id != null) {
            const xLabel = tanMap?.get(String(r.tanar_id));
            parts.push(xLabel ? String(xLabel) : `Tanár #${r.tanar_id}`);
          }

          return parts.filter(Boolean).join(" · ") || `Kurzus`;
        };

        field.options = makeOptionsWithDisambiguation(rows, field.fk.key, baseLabelFn, field.required);
        continue;
      }

      // Hallgató: alapból csak név, ID csak ha duplikált a név
      if (field.fk.table === "hallgato") {
        const baseLabelFn = (r) => {
          const id = r?.[field.fk.key];
          const name = fkInfo?.labelMap?.get(String(id));
          return name ?? id;
        };

        field.options = makeOptionsWithDisambiguation(rows, field.fk.key, baseLabelFn, field.required);
        continue;
      }

      // Default FK: labelField, ID csak ha duplikált a label
      {
        const baseLabelFn = (r) => {
          const id = r?.[field.fk.key];
          const label = fkInfo?.labelMap?.get(String(id));
          return label ?? id;
        };

        field.options = makeOptionsWithDisambiguation(rows, field.fk.key, baseLabelFn, field.required);
      }
    }
  }
}

// --- GENERIKUS CRUD UI EGY ENTITY-HEZ ---
function renderInput(field, entityKey) {
  const common = `name="${escapeHtml(field.name)}" data-entity="${escapeHtml(entityKey)}"`;
  const attrs =
    field.attrs && typeof field.attrs === "object"
      ? Object.entries(field.attrs)
          .map(([k, v]) => `${escapeHtml(k)}="${escapeHtml(v)}"`)
          .join(" ")
      : "";

  const reqAttr = field.required ? "required" : "";

  if (field.type === "select") {
    const options = (field.options || [])
      .map((opt) => {
        const isPlaceholder = !!opt._placeholder;
        const disabled = isPlaceholder ? "disabled" : "";
        const selected = isPlaceholder ? "selected" : "";
        return `<option value="${escapeHtml(opt.value)}" ${disabled} ${selected}>${escapeHtml(
          opt.label ?? String(opt.value)
        )}</option>`;
      })
      .join("");

    return `<select ${common} ${attrs} ${reqAttr}>${options}</select>`;
  }

    if (field.type === "checkbox") {
    return `<input type="checkbox" ${common} ${attrs} />`;
  }

  const typeMapping = {
    number: "number",
    date: "date",
    "datetime-local": "datetime-local",
    email: "email",
  };
  const htmlType = typeMapping[field.type] || "text";

  return `<input type="${htmlType}" ${common} ${attrs} ${reqAttr} />`;
}

function renderEntityView(entityKey) {
  const cfg = ENTITIES[entityKey];
  const view = document.getElementById(`view-${entityKey}`);
  if (!cfg || !view) return;

  const cols = cfg.listColumns;
  const colCount = cols.length + 1;

  const filterOptions = cols.map((c) => `<option value="${escapeHtml(c.field)}">${escapeHtml(c.label)}</option>`).join("");

  view.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2>${escapeHtml(cfg.title)}</h2>
        <button class="btn secondary" data-entity="${escapeHtml(entityKey)}" data-role="refresh">
          Frissítés
        </button>
      </div>

      <div class="entity-layout">
        <div class="entity-list">
          <div class="list-toolbar">
            <div class="filter-row" data-filter-index="0">
              <label>
                Oszlop:
                <select id="filter0-col-${escapeHtml(entityKey)}">
                  ${filterOptions}
                </select>
              </label>
              <label>
                Művelet:
                <select id="filter0-op-${escapeHtml(entityKey)}">
                  <option value="eq">=</option>
                  <option value="like">tartalmaz</option>
                  <option value="gte">&ge;</option>
                  <option value="lte">&le;</option>
                </select>
              </label>
              <label>
                Érték:
                <input type="text" id="filter0-val-${escapeHtml(entityKey)}" />
              </label>
            </div>

            <div class="filter-row" data-filter-index="1">
              <label>
                Oszlop:
                <select id="filter1-col-${escapeHtml(entityKey)}">
                  ${filterOptions}
                </select>
              </label>
              <label>
                Művelet:
                <select id="filter1-op-${escapeHtml(entityKey)}">
                  <option value="eq">=</option>
                  <option value="like">tartalmaz</option>
                  <option value="gte">&ge;</option>
                  <option value="lte">&le;</option>
                </select>
              </label>
              <label>
                Érték:
                <input type="text" id="filter1-val-${escapeHtml(entityKey)}" />
              </label>
            </div>

            <button class="btn small" data-entity="${escapeHtml(entityKey)}" data-role="filter">
              Szűrés
            </button>
            <button class="btn small secondary" data-entity="${escapeHtml(entityKey)}" data-role="clear-filter">
              Szűrő törlése
            </button>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                ${cols.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("")}
                <th>Műveletek</th>
              </tr>
            </thead>
            <tbody id="tbody-${escapeHtml(entityKey)}">
              <tr><td colspan="${colCount}">Nincs adat. Kattints a "Frissítés" gombra a betöltéshez.</td></tr>
            </tbody>
          </table>
        </div>

        <div class="entity-form">
          <h3 id="form-title-${escapeHtml(entityKey)}">Új ${escapeHtml(cfg.singular)}</h3>
          <div id="form-error-${escapeHtml(entityKey)}" class="error hidden"></div>
          <div id="form-success-${escapeHtml(entityKey)}" class="success hidden"></div>

          <form id="form-${escapeHtml(entityKey)}" class="form-grid">
            ${cfg.fields
              .map(
                (f) => `
              <label>
                ${escapeHtml(f.label || f.name)}:
                ${renderInput(f, entityKey)}
              </label>
            `
              )
              .join("")}

            <div class="form-actions">
              <button type="submit" class="btn primary">Mentés</button>
              <button type="button" class="btn secondary"
                      data-entity="${escapeHtml(entityKey)}" data-role="new">
                Új üres űrlap
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  wireEntityHandlers(entityKey);
}

function setFormMessage(entityKey, type, msg) {
  const errBox = document.getElementById(`form-error-${entityKey}`);
  const okBox = document.getElementById(`form-success-${entityKey}`);
  if (!errBox || !okBox) return;

  errBox.classList.add("hidden");
  okBox.classList.add("hidden");

  if (type === "error" && msg) {
    errBox.textContent = msg;
    errBox.classList.remove("hidden");
  } else if (type === "ok" && msg) {
    okBox.textContent = msg;
    okBox.classList.remove("hidden");
  }
}

function fillEntityForm(entityKey, row) {
  const cfg = ENTITIES[entityKey];
  const form = document.getElementById(`form-${entityKey}`);
  const title = document.getElementById(`form-title-${entityKey}`);
  if (!cfg || !form || !title) return;

  for (const f of cfg.fields) {
    const el = form.elements[f.name];
    if (!el) continue;
    const val = row ? row[f.name] : null;

    if (f.type === "select") {
      el.value = val ?? "";
    } else if (f.type === "checkbox") {
      el.checked = !!val;
    } 
    else if (f.type === "number") {
      el.value = val ?? "";
    } else if (f.type === "date") {
      el.value = val ? toDateInputValue(String(val)) : "";
    } else if (f.type === "datetime-local") {
      el.value = val ? toDateTimeLocalValue(String(val)) : "";
    } else {
      el.value = val ?? "";
    }
  }

  const pkFields =
    cfg.pkFields && cfg.pkFields.length ? cfg.pkFields : cfg.idField ? [cfg.idField] : [];
  const hasPk = row && pkFields.length && pkFields.every((f) => row[f] !== null && row[f] !== undefined);

  // PK mezők: edit módban ne lehessen átírni
  for (const f of pkFields) {
    const el = form.elements[f];
    if (el) el.disabled = !!hasPk;
  }

  if (hasPk) {
    const pkText = pkFields.map((f) => `${f}=${row[f]}`).join(", ");
    title.textContent = `${cfg.singular[0].toUpperCase() + cfg.singular.slice(1)} szerkesztése (${pkText})`;
  } else {
    title.textContent = `Új ${cfg.singular}`;
  }
}

async function loadEntityList(entityKey) {
  const cfg = ENTITIES[entityKey];
  const tbody = document.getElementById(`tbody-${entityKey}`);
  if (!cfg || !tbody) return;

  tbody.innerHTML = `<tr><td colspan="${cfg.listColumns.length + 1}">Betöltés...</td></tr>`;
  setFormMessage(entityKey);

  try {
    const state = entityState[entityKey];
    const params = { limit: 200, offset: 0 };

    if (state && Array.isArray(state.filters) && state.filters.length) {
      const activeFilters = state.filters.filter((f) => f && f.col && f.op && f.val !== "");
      if (activeFilters.length) params.filters = JSON.stringify(activeFilters);
    }

    const rows = await apiGet(cfg.api, params);
    state.rows = rows;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="${cfg.listColumns.length + 1}">Nincs adat.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    for (const row of rows) {
      const tds = cfg.listColumns
        .map((c) => {
          const shown = formatCellValue(cfg, c.field, row[c.field]);
          return `<td>${escapeHtml(shown)}</td>`;
        })
        .join("");

      const pkKey = pkKeyFromRow(cfg, row);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        ${tds}
        <td>
          <button class="btn small" data-role="edit"
                  data-entity="${escapeHtml(entityKey)}" data-pk="${escapeHtml(pkKey)}">✏️</button>
          <button class="btn small danger" data-role="delete"
                  data-entity="${escapeHtml(entityKey)}" data-pk="${escapeHtml(pkKey)}">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    tbody.querySelectorAll("button[data-role]").forEach((btn) => {
      const pkKey = btn.dataset.pk;
      const role = btn.dataset.role;

      btn.addEventListener("click", async () => {
        const state = entityState[entityKey];
        const row = findRowByPkKey(cfg, state.rows, pkKey);

        if (role === "edit" && row) {
          state.currentEdit = row;
          fillEntityForm(entityKey, row);
        } else if (role === "delete" && row) {
          if (!confirm("Biztosan törlöd ezt a rekordot?")) return;
          try {
            await apiDelete(`${cfg.api}${pkPathFromKey(pkKey)}`);
            await loadEntityList(entityKey);
          } catch (e) {
            console.error(e);
            alert("Törlés sikertelen.");
          }
        }
      });
    });
  } catch (e) {
    console.error(e);
    tbody.innerHTML = `<tr><td colspan="${cfg.listColumns.length + 1}">Lista betöltése sikertelen.</td></tr>`;
  }
}

function wireEntityHandlers(entityKey) {
  const cfg = ENTITIES[entityKey];
  const view = document.getElementById(`view-${entityKey}`);
  if (!cfg || !view) return;

  const form = document.getElementById(`form-${entityKey}`);
  if (!form) return;

  const refreshBtn = view.querySelector(`button[data-role="refresh"][data-entity="${entityKey}"]`);
  const newBtn = view.querySelector(`button[data-role="new"][data-entity="${entityKey}"]`);
  const filterBtn = view.querySelector(`button[data-role="filter"][data-entity="${entityKey}"]`);
  const clearFilterBtn = view.querySelector(`button[data-role="clear-filter"][data-entity="${entityKey}"]`);


// --- Filter UI: oszloptól függő input típus / FK select ---
function syncFilterRow(i) {
  const colSel = view.querySelector(`#filter${i}-col-${entityKey}`);
  const opSel = view.querySelector(`#filter${i}-op-${entityKey}`);
  let valEl = view.querySelector(`#filter${i}-val-${entityKey}`);
  if (!colSel || !opSel || !valEl) return;

  const col = colSel.value;
  const field = (cfg.fields || []).find((f) => f.name === col);

  const wantSelect = !!(
  Array.isArray(field?.options) &&
  field.options.length &&
  (field?.fk || field?.type === "select")
);

// select mező kell
if (wantSelect && valEl.tagName !== "SELECT") {
  const sel = document.createElement("select");
  sel.id = valEl.id;

  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "";
  sel.appendChild(empty);

  for (const opt of field.options) {
    const o = document.createElement("option");
    o.value = String(opt.value ?? "");
    o.textContent = String(opt.label ?? opt.value ?? "");
    sel.appendChild(o);
  }

  valEl.replaceWith(sel);
  valEl = sel;
}

// sima input kell
if (!wantSelect && valEl.tagName === "SELECT") {
  const inp = document.createElement("input");
  inp.id = valEl.id;
  inp.type = "text";
  valEl.replaceWith(inp);
  valEl = inp;
}

  // input típus a kiválasztott oszlop alapján
  if (valEl.tagName === "INPUT") {
    const map = {
      number: "number",
      date: "date",
      "datetime-local": "datetime-local",
      email: "email",
    };
    const t = map[field?.type] || "text";
    if (valEl.type !== t) {
      valEl.value = ""; // típusváltásnál tisztább, ha ürül
      valEl.type = t;
    }
    if (t === "number") valEl.step = "any";
    else valEl.removeAttribute("step");
  }

  // op "like" ne legyen date/FK esetén (zavaró, és backend úgyis eq-re esik vissza)
  const likeOpt = opSel.querySelector('option[value="like"]');
  if (likeOpt) likeOpt.disabled = wantSelect || field?.type === "date" || field?.type === "datetime-local";

  if (wantSelect && opSel.value === "like") opSel.value = "eq";
}

// init + oszlopváltáskor frissítjük a filter UI-t
for (let i = 0; i < 2; i++) {
  const colSel = view.querySelector(`#filter${i}-col-${entityKey}`);
  colSel?.addEventListener("change", () => syncFilterRow(i));
  syncFilterRow(i);
}

  function collectFilters() {
    const filters = [];
    for (let i = 0; i < 2; i++) {
      const colSel = view.querySelector(`#filter${i}-col-${entityKey}`);
      const opSel = view.querySelector(`#filter${i}-op-${entityKey}`);
      const valInput = view.querySelector(`#filter${i}-val-${entityKey}`);
      if (!colSel || !opSel || !valInput) continue;

      const col = colSel.value;
      const op = opSel.value;
      const val = valInput.value; // itt még lehet label is

      if (!col || !op || val === undefined || val === null || String(val).trim() === '') continue;

      const normalized = normalizeFilterForColumn(cfg, col, op, val);
      if (!normalized) continue;
      filters.push(normalized);
    }
    return filters;
  }

  refreshBtn?.addEventListener("click", () => loadEntityList(entityKey));

  filterBtn?.addEventListener("click", () => {
    const state = entityState[entityKey];
    if (!state) return;
    state.filters = collectFilters();
    loadEntityList(entityKey);
  });

  clearFilterBtn?.addEventListener("click", () => {
    const state = entityState[entityKey];
    if (!state) return;
    state.filters = [];
    for (let i = 0; i < 2; i++) {
      const valInput = view.querySelector(`#filter${i}-val-${entityKey}`);
      if (valInput) valInput.value = "";
    }
    loadEntityList(entityKey);
  });

  newBtn?.addEventListener("click", () => {
    entityState[entityKey].currentEdit = null;
    fillEntityForm(entityKey, null);
    setFormMessage(entityKey);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setFormMessage(entityKey);

    const payload = {};
    for (const f of cfg.fields) {
      const el = form.elements[f.name];
      if (!el) continue;

      let val = el.value;
      if (f.type === "checkbox") {
        val = el.checked;
      } else if (f.type === "number") {
        val = val === "" ? null : Number(val);
      } else if (f.type === "select") {
        if (val === "") {
          val = null;
        } else if (f.fk) {
          val = Number(val);
        }
      } else if (f.type === "datetime-local") {
        // "YYYY-MM-DDTHH:mm" -> "YYYY-MM-DD HH:mm:ss"
        if (val === "") val = null;
        else val = val.replace("T", " ") + ":00";
      } else if (f.type === "date") {
        if (val === "") val = null;
      } else {
        if (val === "") val = null;
      }

      if (f.required && (val === null || val === "")) {
        setFormMessage(entityKey, "error", `A(z) "${f.label}" mező kötelező.`);
        return;
      }

      payload[f.name] = val;
    }

    const state = entityState[entityKey];

    const pkFields =
      cfg.pkFields && cfg.pkFields.length ? cfg.pkFields : cfg.idField ? [cfg.idField] : [];

    const hasEdit =
      !!state.currentEdit &&
      pkFields.length > 0 &&
      pkFields.every((f) => state.currentEdit[f] !== null && state.currentEdit[f] !== undefined);

    // Dupla kompozit PK védelem (pl. beiratkozas)
    if (!hasEdit && pkFields.length > 1) {
      const dup = (state.rows || []).some((r) => pkFields.every((f) => String(r[f]) === String(payload[f])));
      if (dup) {
        setFormMessage(
          entityKey,
          "error",
          `Már létezik ilyen rekord (${pkFields.map((f) => `${f}=${payload[f]}`).join(", ")})`
        );
        return;
      }
    }

    try {
      let result;
      if (hasEdit) {
        const pkKey = pkKeyFromRow(cfg, state.currentEdit);
        result = await apiPut(`${cfg.api}${pkPathFromKey(pkKey)}`, payload);
        setFormMessage(entityKey, "ok", "Rekord frissítve.");
      } else {
        result = await apiPost(cfg.api, payload);
        setFormMessage(entityKey, "ok", "Rekord létrehozva.");
      }

      state.currentEdit = result;
      fillEntityForm(entityKey, result);
      await loadEntityList(entityKey);
    } catch (e) {
      console.error(e);
      if (e && e.error === "UNIQUE_VIOLATION") {
        setFormMessage(entityKey, "error", `Egyediség sértés (${e.field} = ${e.value}).`);
      } else if (e && e.error === "VALIDATION_FAILED") {
        const msg = e.details?.map((x) => x.message).join("; ") || "Validációs hiba.";
        setFormMessage(entityKey, "error", msg);
      } else {
        setFormMessage(entityKey, "error", "Mentés sikertelen.");
      }
    }
  });
}

// --- BOOTSTRAP ---
async function bootstrap() {
  try {
    const meta = await fetchMeta();
    ENTITIES = buildEntitiesFromMeta(meta);

    await enrichEntitiesWithFkOptions();

    initEntityState();
    renderLayout();

    Object.keys(ENTITIES).forEach((key) => renderEntityView(key));

    initStatsUI({
      containerId: "view-stats",
      apiBase: API_BASE,
    });
  } catch (e) {
    console.error(e);
    const app = document.querySelector("#app");
    if (app) app.innerHTML = "<p>Hiba az alkalmazás inicializálásakor (meta nem érhető el).</p>";
  }
}

bootstrap();
