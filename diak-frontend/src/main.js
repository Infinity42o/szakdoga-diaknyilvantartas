// src/main.js

import './style.css';

const API_BASE = 'http://localhost:3000/api';

// --- Kis helper az API hívásokhoz ---
async function apiGet(path, params = {}) {
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, v);
    }
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

async function apiPut(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

async function apiDelete(path) {
  const res = await fetch(API_BASE + path, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    throw data;
  }
}

// --- UI építés ---

function renderLayout() {
  const app = document.querySelector('#app');
  app.innerHTML = `
    <div class="app">
      <header class="topbar">
        <h1>Diáknyilvántartás – generált alkalmazás</h1>
        <span class="env-badge">API: ${API_BASE}</span>
      </header>

      <nav class="tabs">
        <button data-view="list"  class="tab active">Hallgatók</button>
        <button data-view="form"  class="tab">Új / szerkesztés</button>
        <button data-view="stats" class="tab">Statisztikák</button>
      </nav>

      <main class="content">
        <section id="view-list"  class="view"></section>
        <section id="view-form"  class="view hidden"></section>
        <section id="view-stats" class="view hidden"></section>
      </main>
    </div>
  `;

  // Tab váltás
  app.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      app.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const view = btn.dataset.view;
      app.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
      app.querySelector(`#view-${view}`).classList.remove('hidden');
    });
  });
}

// --- Hallgató lista + szűrés ---

let currentEdit = null; // itt jegyezzük meg, kit szerkesztünk

async function renderHallgatoList() {
  const root = document.querySelector('#view-list');
  root.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2>Hallgatók</h2>
        <button id="btn-refresh" class="btn secondary">Frissítés</button>
      </div>

      <div class="filters">
        <label>
          Név:
          <input id="filter-nev" type="text" placeholder="pl. Kiss" />
        </label>
        <label>
          Szak:
          <input id="filter-szak" type="text" placeholder="pl. Programtervező" />
        </label>
        <button id="btn-apply-filters" class="btn">Szűrés</button>
        <button id="btn-clear-filters" class="btn secondary">Törlés</button>
      </div>

      <div id="list-error" class="error hidden"></div>

      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Neptun</th>
            <th>Név</th>
            <th>Nem</th>
            <th>Szak</th>
            <th>Évfolyam</th>
            <th>Születési dátum</th>
            <th>Email</th>
            <th>Műveletek</th>
          </tr>
        </thead>
        <tbody id="hallgato-tbody">
          <tr><td colspan="9">Betöltés...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  async function loadList() {
    const tbody = root.querySelector('#hallgato-tbody');
    const err  = root.querySelector('#list-error');
    err.classList.add('hidden');
    tbody.innerHTML = `<tr><td colspan="9">Betöltés...</td></tr>`;

    try {
      const nev  = root.querySelector('#filter-nev').value.trim();
      const szak = root.querySelector('#filter-szak').value.trim();

      let params = { limit: 100, offset: 0 };
      if (nev || szak) {
        const where = {};
        if (nev) where.nev = nev;
        if (szak) where.szak = szak;
        params.where = JSON.stringify(where);
      }

      const rows = await apiGet('/hallgato', params);
      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="9">Nincs találat.</td></tr>`;
        return;
      }

      tbody.innerHTML = '';
      for (const h of rows) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${h.id ?? ''}</td>
          <td>${h.neptun ?? ''}</td>
          <td>${h.nev ?? ''}</td>
          <td>${h.nem ?? ''}</td>
          <td>${h.szak ?? ''}</td>
          <td>${h.evfolyam ?? ''}</td>
          <td>${h.szuldatum ?? ''}</td>
          <td>${h.email ?? ''}</td>
          <td>
            <button class="btn small" data-action="edit" data-id="${h.id}">✏️</button>
            <button class="btn small danger" data-action="delete" data-id="${h.id}">🗑️</button>
          </td>
        `;
        tbody.appendChild(tr);
      }

      // Edit / delete handler
      tbody.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = Number(btn.dataset.id);
          if (!id) return;

          if (btn.dataset.action === 'edit') {
            const row = rows.find(r => r.id === id);
            currentEdit = row;
            switchToFormWithData(row);
          } else if (btn.dataset.action === 'delete') {
            if (!confirm('Biztosan törlöd ezt a hallgatót?')) return;
            try {
              await apiDelete(`/hallgato/${id}`);
              await loadList();
            } catch (e) {
              alert('Törlés sikertelen');
              console.error(e);
            }
          }
        });
      });

    } catch (e) {
      console.error(e);
      const err = root.querySelector('#list-error');
      err.textContent = 'Lista betöltése sikertelen.';
      err.classList.remove('hidden');
    }
  }

  root.querySelector('#btn-refresh').addEventListener('click', loadList);
  root.querySelector('#btn-apply-filters').addEventListener('click', loadList);
  root.querySelector('#btn-clear-filters').addEventListener('click', () => {
    root.querySelector('#filter-nev').value = '';
    root.querySelector('#filter-szak').value = '';
    loadList();
  });

  loadList();
}

// --- Űrlap (create / update) ---

function renderHallgatoForm() {
  const root = document.querySelector('#view-form');
  root.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2 id="form-title">Új hallgató</h2>
      </div>

      <div id="form-error" class="error hidden"></div>
      <div id="form-success" class="success hidden"></div>

      <form id="hallgato-form" class="form-grid">
        <label>
          Neptun*:
          <input name="neptun" maxlength="6" required />
        </label>
        <label>
          Név*:
          <input name="nev" required />
        </label>
        <label>
          Nem:
          <select name="nem">
            <option value="">(nincs)</option>
            <option value="ferfi">Férfi</option>
            <option value="no">Nő</option>
            <option value="egyeb">Egyéb</option>
          </select>
        </label>
        <label>
          Szak:
          <input name="szak" />
        </label>
        <label>
          Évfolyam:
          <input name="evfolyam" type="number" min="0" max="10" />
        </label>
        <label>
          Születési dátum:
          <input name="szuldatum" type="date" />
        </label>
        <label>
          Email:
          <input name="email" type="email" />
        </label>

        <div class="form-actions">
          <button type="submit" class="btn primary">Mentés</button>
          <button type="button" id="btn-form-reset" class="btn secondary">Új üres űrlap</button>
        </div>
      </form>
    </div>
  `;

  const form = root.querySelector('#hallgato-form');
  const errBox = root.querySelector('#form-error');
  const okBox  = root.querySelector('#form-success');
  const title  = root.querySelector('#form-title');

  function setMessage(type, msg) {
    errBox.classList.add('hidden');
    okBox.classList.add('hidden');
    if (type === 'error') {
      errBox.textContent = msg;
      errBox.classList.remove('hidden');
    } else if (type === 'ok') {
      okBox.textContent = msg;
      okBox.classList.remove('hidden');
    }
  }

  function fillForm(data) {
    form.neptun.value    = data?.neptun ?? '';
    form.nev.value       = data?.nev ?? '';
    form.nem.value       = data?.nem ?? '';
    form.szak.value      = data?.szak ?? '';
    form.evfolyam.value  = data?.evfolyam ?? '';
    form.szuldatum.value = data?.szuldatum ?? '';
    form.email.value     = data?.email ?? '';
    title.textContent    = data && data.id ? `Hallgató szerkesztése (ID: ${data.id})` : 'Új hallgató';
  }

  // Külsőleg is elérhető legyen
  window._fillHallgatoForm = fillForm;

  root.querySelector('#btn-form-reset').addEventListener('click', () => {
    currentEdit = null;
    fillForm(null);
    setMessage();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage();

    const payload = {
      neptun: form.neptun.value.trim(),
      nev: form.nev.value.trim(),
      nem: form.nem.value || null,
      szak: form.szak.value || null,
      evfolyam: form.evfolyam.value ? Number(form.evfolyam.value) : null,
      szuldatum: form.szuldatum.value || null,
      email: form.email.value || null,
    };

    if (!payload.neptun || payload.neptun.length !== 6) {
      return setMessage('error', 'A Neptun kód 6 karakter legyen.');
    }
    if (!payload.nev) {
      return setMessage('error', 'A név kötelező.');
    }

    try {
      let result;
      if (currentEdit && currentEdit.id) {
        result = await apiPut(`/hallgato/${currentEdit.id}`, payload);
        setMessage('ok', 'Hallgató frissítve.');
      } else {
        result = await apiPost('/hallgato', payload);
        setMessage('ok', 'Hallgató létrehozva.');
        currentEdit = result;
      }
      fillForm(result);
    } catch (e) {
      console.error(e);
      if (e && e.error === 'UNIQUE_VIOLATION') {
        setMessage('error', `Egyediség sértés (${e.field} = ${e.value})`);
      } else if (e && e.error === 'VALIDATION_FAILED') {
        setMessage('error', e.details?.map(x => x.message).join('; ') || 'Validációs hiba.');
      } else {
        setMessage('error', 'Mentés sikertelen.');
      }
    }
  });

  // induláskor üres űrlap
  fillForm(null);
}

// Kívülről hívható a lista -> form átállás
function switchToFormWithData(row) {
  const app = document.querySelector('#app');
  app.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  app.querySelector('.tab[data-view="form"]').classList.add('active');

  app.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.querySelector('#view-form').classList.remove('hidden');

  if (window._fillHallgatoForm) {
    window._fillHallgatoForm(row);
  }
}

// --- STATISZTIKÁK (Chart.js) ---

let gradesChart, bySzakChart, creditsChart;

async function renderStats() {
  const root = document.querySelector('#view-stats');
  root.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2>Statisztikák</h2>
        <button id="btn-refresh-stats" class="btn secondary">Frissítés</button>
      </div>

      <div id="stats-error" class="error hidden"></div>

      <div class="charts-grid">
        <div>
          <h3>Jegyek eloszlása</h3>
          <canvas id="chart-grades" height="160"></canvas>
        </div>
        <div>
          <h3>Hallgatók száma szakonként</h3>
          <canvas id="chart-szak" height="160"></canvas>
        </div>
        <div>
          <h3>Összesített kreditek hallgatónként</h3>
          <canvas id="chart-credits" height="160"></canvas>
        </div>
      </div>
    </div>
  `;

  async function loadStats() {
    const errBox = root.querySelector('#stats-error');
    errBox.classList.add('hidden');
    errBox.textContent = '';

    try {
      const [grades, bySzak, credits] = await Promise.all([
        apiGet('/stats/grades'),
        apiGet('/stats/by-szak'),
        apiGet('/stats/credits-per-student'),
      ]);

      // Jegyek
      const gLabels = grades.map(r => r.jegy);
      const gValues = grades.map(r => r.db);

      if (gradesChart) gradesChart.destroy();
      gradesChart = new Chart(document.getElementById('chart-grades'), {
        type: 'bar',
        data: {
          labels: gLabels,
          datasets: [{
            label: 'Hallgatók száma',
            data: gValues,
          }],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
          },
        },
      });

      // Szakonként
      const sLabels = bySzak.map(r => r.szak);
      const sValues = bySzak.map(r => r.db);

      if (bySzakChart) bySzakChart.destroy();
      bySzakChart = new Chart(document.getElementById('chart-szak'), {
        type: 'bar',
        data: {
          labels: sLabels,
          datasets: [{
            label: 'Hallgatók száma',
            data: sValues,
          }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          plugins: {
            legend: { display: false },
          },
        },
      });

      // Kreditek
      const cLabels = credits.map(r => r.nev || r.neptun || r.id);
      const cValues = credits.map(r => r.ossz_kredit);

      if (creditsChart) creditsChart.destroy();
      creditsChart = new Chart(document.getElementById('chart-credits'), {
        type: 'bar',
        data: {
          labels: cLabels,
          datasets: [{
            label: 'Összesített kredit',
            data: cValues,
          }],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
          },
        },
      });

    } catch (e) {
      console.error(e);
      errBox.textContent = 'Statisztikák betöltése sikertelen.';
      errBox.classList.remove('hidden');
    }
  }

  root.querySelector('#btn-refresh-stats').addEventListener('click', loadStats);
  loadStats();
}

// --- INIT ---

renderLayout();
renderHallgatoList();
renderHallgatoForm();
renderStats();
