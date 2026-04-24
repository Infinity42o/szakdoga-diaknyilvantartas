# Szakdolgozat – MySQL → generált CRUD + statisztika alkalmazás

Ez a projekt egy **adatbázis‑alapú kódgenerátort** tartalmaz. A generátor egy **MySQL SQL script** (CREATE TABLE + INSERT INTO) alapján:

- **felismeri a táblák szerkezetét** (oszlopok, PK/UK/INDEX, FK kapcsolatok),
- **feldolgozza a kezdeti tartalmat** (INSERT INTO),
- legenerál egy **Express + Sequelize** alapú backend API‑t (CRUD + meta + statisztika),
- a mellékelt (generikus) frontend pedig a meta alapján **dinamikusan** kirajzolja a táblák kezelőfelületét és a statisztikát.

A cél: egy adott adatbázissémához gyorsan előállítható, működő CRUD alkalmazás grafikus felülettel és alap statisztikákkal.

---

## Tartalom

- [Követelmények](#követelmények)
- [Gyors indítás (demo)](#gyors-indítás-demo)
- [Generálás másik SQL scriptből](#generálás-másik-sql-scriptből)
- [Kezdeti adatok (INSERT INTO)](#kezdeti-adatok-insert-into)
- [API végpontok](#api-végpontok)
- [Statisztika fül működése](#statisztika-fül-működése)
- [Gyakori hibák](#gyakori-hibák)

---

## Követelmények

- **Node.js 18+** (ajánlott 20+)
- **MySQL / MariaDB**
- (Opcionális) MySQL kliens: Workbench / phpMyAdmin / CLI

---

## Gyors indítás (demo)

A repo tartalmaz egy minta adatbázisscriptet: `db/diaknyilvantartas.sql`.

### 1) Adatbázis import

Hozz létre egy adatbázist (pl. `diaknyilvantartas`), majd importáld a scriptet.

### 2) Backend indítása

```bash
cd generator
npm install

# Állítsd be a DB kapcsolatot:
# generator/.env (vagy másold a .env.example-t)

npm run start:backend
```

A backend alapból: `http://localhost:3000`

Ellenőrzés:
- `GET http://localhost:3000/health`

### 3) Frontend indítása

<<<<<<< HEAD
2. Adatbázis importálása

A projekt gyökerében található:

db/diaknyilvantartas.sql

2.1. phpMyAdmin (XAMPP) – ajánlott

Indítsd a MySQL-t a XAMPP Control Panelben.

Böngészőben: http://localhost/phpmyadmin/.

Ha kell, hozz létre egy új adatbázist: diaknyilvantartas (utf8mb4_general_ci).

Válaszd ki az adatbázist → Import → tallózd be: db/diaknyilvantartas.sql → Go.

2.2. Ellenőrzés

phpMyAdmin vagy Workbench-ben:

USE diaknyilvantartas;
SHOW TABLES;

SELECT COUNT(*) FROM hallgato;
SELECT COUNT(*) FROM tanar;
SELECT COUNT(*) FROM tantargy;
SELECT COUNT(*) FROM kurzus;
SELECT COUNT(*) FROM beiratkozas;

SELECT * FROM v_tantargy_atlag LIMIT 5;
SELECT * FROM v_szak_hallgatoszam LIMIT 5;
SELECT * FROM v_hallgato_kredit LIMIT 5;

3. Generátor + backend

A backend a generator/ mappán belül található, Node.js + Express + Sequelize alapokon.

3.1. .env beállítása

A generator/ könyvtárban:

cd generator
copy .env.example .env


Nyisd meg a .env fájlt, és állítsd be a saját XAMPP/MySQL paramétereid szerint:

PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=diaknyilvantartas
DB_PORT=3306

3.2. Csomagok telepítése
cd C:\projektek\szakdoga\generator
npm install

3.3. Adatbázis-kapcsolat tesztelése
npm run db:ping


Ha minden rendben, kapsz összefoglalót a hallgatók számáról, jegy-eloszlásról stb.

3.4. Backend generálása (Express + Sequelize)

Ha módosítod a sémát, újra tudod generálni a backendet:

npm run gen:backend


Ekkor létrejön / frissül:

generator/backend/app.js

generator/backend/db/index.js

generator/backend/models/*.js

generator/backend/routes/*.js (CRUD)

generator/backend/routes/stats.js (statisztikák)

3.5. Backend indítása
npm run start:backend


Ha sikerült:

Műkszik, API listening on port 3000


Egészség-ellenőrzés:

Invoke-RestMethod http://localhost:3000/health

4. REST API áttekintés

Alap URL: http://localhost:3000/api

4.1. CRUD végpontok (automatikusan generált)

Példa a hallgato táblára:

GET /api/hallgato – lista (opcionálisan ?limit=&offset= és ?where= paraméterekkel)

GET /api/hallgato/{id} – hallgató lekérése azonosító alapján

POST /api/hallgato – új hallgató felvétele (JSON törzs)

PUT /api/hallgato/{id} – meglévő hallgató módosítása

DELETE /api/hallgato/{id} – hallgató törlése

Hasonlóan működik: tanar, tantargy, kurzus, beiratkozas.

4.2. Statisztikai végpontok

GET /api/stats/grades
Jegyek eloszlása (2–5):

[
  { "jegy": 2, "db": 1 },
  { "jegy": 3, "db": 2 },
  ...
]


GET /api/stats/by-szak
Hallgatók száma szakonként:

[
  { "szak": "Programtervező informatikus", "db": 5 },
  { "szak": "Gazdaságinformatikus", "db": 3 },
  ...
]


GET /api/stats/credits-per-student
Összesített kreditek hallgatónként:

[
  { "id": 3, "neptun": "GHI789", "nev": "Szabó Gábor", "ossz_kredit": 10 },
  ...
]

5. Frontend (Vite + JS)

A frontend egy egyszerű, generált webes felület, amely a backend REST API-t használja.

5.1. Telepítés
cd C:\projektek\szakdoga\diak-frontend
npm install


Ha Node-verzió hibát ad (Vite): frissíts Node-ot legalább 20.19+ vagy 22.12+ verzióra.

5.2. Fejlesztői szerver indítása
npm run dev


A konzolban látod a címet, pl.:

  VITE vX.X.X  ready in ...
  ➜  Local:   http://127.0.0.1:5173/


Böngészőben nyisd meg: http://127.0.0.1:5173/.

5.3. Felhasználói felület – rövid leírás

A jelenlegi frontend:

Hallgatók listázása a /api/hallgato végpont alapján

Egyszerű lista nézet, táblázatos formában:

név, Neptun-kód, szak, évfolyam, e-mail

Később bővíthető:

új hallgató felvétele űrlappal

szerkesztés/törlés gombok

szűrés (szak, évfolyam, név)

statisztikai diagramok megjelenítése (/api/stats/* végpontok alapján)

6. Rendszerarchitektúra – röviden (dolgozat-vázlat)
6.1. Logikai rétegek

Adatbázis réteg

MariaDB/MySQL adatbázis

Táblák: hallgato, tanar, tantargy, kurzus, beiratkozas

Nézetek: v_tantargy_atlag, v_szak_hallgatoszam, v_hallgato_kredit

Integritási megkötések: PK, FK, UNIQUE, CHECK (verziótól függően)

Generátor (backend codegen)

Forrás: db/diaknyilvantartas.sql

lépés: SQL → séma (out/schema.json)

táblák, oszlopok, típusok, PK/FK/UNIQUE/index, ENUM-ok

lépés: séma → Node.js backend

Sequelize modellek (backend/models)

Express routerek (backend/routes)

Statisztika router (backend/routes/stats.js)

DB inicializáció (backend/db/index.js)

Express app (backend/app.js)

Backend alkalmazás (REST API)

Technológiák: Node.js, Express, Sequelize, mysql2, dotenv, cors

JSON alapú REST interfész:

CRUD műveletek minden fő entitásra

statisztikai aggregációk (SQL GROUP BY, JOIN, nézetek)

Konfiguráció: .env fájl (DB elérés, port)

Frontend alkalmazás

Technológiák: Vite, vanilla JavaScript, fetch API, egyszerű CSS

Funkciók:

hallgatók listázása

alap interakció a backenddel (GET/POST/PUT/DELETE – bővíthető)

statisztikák megjelenítése (következő lépés: Chart.js / Recharts)

6.2. Kommunikációs minta

Frontend → Backend: HTTP/HTTPS, JSON (REST API)

Backend → Adatbázis: Sequelize ORM + mysql2 driver, TCP (3306)

Generátor → Adatbázis / SQL fájl:

introspect: élő DB-ből (npm run introspect)

parse: SQL dump fájlból (npm run parse / npm run generate)

7. Hasznos parancsok összefoglalva
Projekt gyökér
cd C:\projektek\szakdoga

Generator / backend
cd generator

# csomagok
npm install

# DB kapcsolat teszt
npm run db:ping

# séma introspect (élő DB-ből)
npm run introspect

# backend generálás
npm run gen:backend

# backend indítás
npm run start:backend

Frontend
cd diak-frontend
=======
```bash
cd ../diak-frontend
>>>>>>> 1ae3726 (Frissített projektverzió)
npm install
npm run dev
```

Frontend alapból: `http://localhost:5173`

> A frontend API címe jelenleg a `diak-frontend/src/main.js` fájlban van:
> `const API_BASE = "http://localhost:3000/api";`

---

## Generálás másik SQL scriptből

A generátor két lépésből áll:

1. **SQL → schema.json + seed.sql** (`generator/src/generate.js`)
2. **schema.json → backend forráskód** (`generator/src/generate-backend.js`)

### 1) SQL feldolgozása (DDL + DML)

```bash
cd generator
node src/generate.js <input.sql> [outDir]

# Példa:
node src/generate.js ../db/diaknyilvantartas.sql ./out
```

Kimenet:
- `out/schema.json` – a sémaleírás (táblák, oszlopok, kulcsok, FK-k)
- `out/seed.sql` – a scriptben lévő INSERT INTO-kból összeállított "seed" (kezdeti adatok)

### 2) Backend legenerálása

```bash
cd generator
node src/generate-backend.js ./out/schema.json ./backend

# vagy a meglévő npm script:
npm run gen:backend
```

A generált backend fő fájlja: `backend/app.js`.

Indítás:

```bash
cd generator
npm run start:backend
```

> Megjegyzés: a backend a futási könyvtárból tölti be a `.env`‑et (`dotenv.config()`), ezért tipikusan a `generator/` mappából érdemes indítani.

---

## Kezdeti adatok (INSERT INTO)

A feladatkiírás "kezdeti tartalom" része miatt a generátor **feldolgozza az INSERT INTO utasításokat is**:

- a `generate.js` a bemeneti SQL‑ből kigyűjti az INSERT‑eket,
- és létrehozza az `out/seed.sql` fájlt.

**Fontos:** a generátor **nem futtat SQL-t** a DB‑n – csak kódot/scripteket állít elő.
A kezdeti adatok betöltéséhez importáld az alábbiak egyikét:

- **(egyszerű)** az eredeti `input.sql` fájlt (ha CREATE + INSERT egyben van), vagy
- **(külön)** a CREATE TABLE részt, majd utána az `out/seed.sql`‑t.

---

## API végpontok

A generált backend minden táblához létrehoz egy CRUD route‑ot:

- `GET    /api/<tabla>` – listázás (támogat `limit`, `offset`, `filters` paramétert)
- `GET    /api/<tabla>/<pk>` – rekord lekérése PK alapján (kompozit PK is támogatott)
- `POST   /api/<tabla>` – beszúrás
- `PUT    /api/<tabla>/<pk>` – módosítás
- `DELETE /api/<tabla>/<pk>` – törlés

Meta és statisztika:

- `GET /api/meta` – táblák + oszlop meta (dimenziók/metrikák, FK info)
- `GET /api/stats/aggregate?table=...&groupBy=...&agg=...&field=...&excludeNull=1`

A `stats/aggregate` támogatott aggregációk: `count`, `sum`, `avg`, `min`, `max`.

> Biztonság: a stat endpoint táblákat/oszlopokat `describeTable` alapján validál, az azonosítókat backtick-kel idézi.

---

## Statisztika fül működése

A statisztika felület generikus (nem kézzel táblánként "drótozott"):

- a táblák / oszlopok listája a `GET /api/meta` válaszból jön,
- **dimenzió** = csoportosító mező (pl. szak / típus / FK mező)
- **metrika** = numerikus mező, amin `sum/avg/min/max` fut (pl. jegy)

Min/max/avg/sum csak akkor engedélyezett, ha az adott táblához van numerikus metrika.

FK csoportosítás esetén a UI megpróbálja "szépen" megjeleníteni a csoportokat:

- pl. `hallgato_id` → `Varga Réka (#4)`
- a `(#id)` rész ki‑/bekapcsolható az **„ID megjelenítése”** opcióval.

Dátum mezők alapból rejtve vannak, mert könnyen túl sok kategóriát eredményeznek; a **„Dátum mezők”** checkbox-szal visszakapcsolhatók.

---

## Elérhető npm scriptek (generator)

A `generator/package.json` tartalmazza a legfontosabb lépéseket:

- `npm run parse:dump` – a demo SQL-ből (`../db/diaknyilvantartas.sql`) elkészíti az `out/schema.json` + `out/seed.sql` fájlokat
- `npm run gen:backend` – az `out/schema.json` alapján legenerálja a backendet a `generator/backend/` mappába
- `npm run gen:backend:app` – ugyanaz, de a kimenet a `generated-app/backend/` mappába kerül (ha ezt a struktúrát szeretnéd)
- `npm run start:backend` – elindítja a generált backendet (`node -r dotenv/config ./backend/app.js`)

---

## Gyakori hibák

### "Nem találom a sémát: .../out/schema.json"

- Előbb futtasd a parser lépést:

```bash
cd generator
npm run parse:dump
```

vagy:

```bash
node src/generate.js <input.sql> ./out
```

### DB kapcsolat hiba (backend)

- Ellenőrizd a `generator/.env` beállításait:
  - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`
- Győződj meg róla, hogy az adatbázis létezik és a táblák importálva vannak.

### Statisztika "furcsa" címkék FK-nál

A címkefeloldás heurisztikával választ "név" jellegű mezőt (pl. `nev`, `name`, `megnevezes`, stb.).
Ha egy hivatkozott táblában több jó jelölt van (pl. kurzusnál "felev" vs. "tantargy"), akkor előfordulhat, hogy nem azt választja, amit te vársz.
Ilyenkor:

- kapcsold be az **„ID megjelenítése”** opciót (mindig egyértelmű marad),
- vagy módosítsd a preferált mezőnevek listáját a `diak-frontend/src/stats.js` fájlban (`pickLabelFieldForTable`).

## Miért generikus?

Az alkalmazás nem egy konkrét adatbázisra van „rádrótozva”: a generátor a bemeneti MySQL SQL scriptből előállított `schema.json` alapján dolgozik.  
Minden táblához automatikusan létrejön a Sequelize modell és a hozzá tartozó CRUD route, így a backend végpontok a séma változásával együtt újragenerálhatók.  
A frontend nem tartalmaz táblaspecifikus kódot: a `GET /api/meta` végpontból kapott metaadatok alapján építi fel a táblalistát, űrlapokat és listázó nézeteket.  
A statisztika oldal szintén meta-driven: a táblát/dimenziót/metrikát a meta alapján kínálja fel, a lekérdezést pedig a generikus `GET /api/stats/aggregate` végpont szolgálja ki.  
Ennek eredménye, hogy másik adatbázis használatához jellemzően elég új SQL dumpot adni a generátornak és újragenerálni a backendet; a frontend változtatás nélkül alkalmazkodik.  