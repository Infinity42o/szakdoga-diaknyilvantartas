# Diáknyilvántartás – generált webes alkalmazás

Szakdolgozat projekt: **adatbázis-alapú webes alkalmazás automatikus generálása**.

A rendszer három fő részből áll:

1. **Adatbázis** – `db/diaknyilvantartas.sql` (hallgató, tanár, tantárgy, kurzus, beiratkozás, nézetek)
2. **Generátor + backend** – `generator/` könyvtár (SQL → séma → Express + Sequelize REST API)
3. **Frontend** – `diak-frontend/` könyvtár (Vite + vanilla JS, fetch API a backendhez)

---

## 1. Követelmények

- **OS:** Windows 11
- **Adatbázis:** XAMPP (MariaDB/MySQL) + phpMyAdmin *vagy* MySQL Workbench
- **Node.js:**  
  - legalább **20.19+** vagy **22.12+** (Vite miatt!)
- **Csomagkezelő:** npm (Node része)
- **Fejlesztői eszközök:** Visual Studio Code, Windows Terminal / PowerShell

Ellenőrzés:

```powershell
node -v
npm -v

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
npm install
npm run dev

8. További tervek

Frontend bővítése:

teljes CRUD űrlapokkal

szűrés, keresés, rendezés

jegyeloszlás és kredit-statisztikák grafikonokkal

Generátor továbbfejlesztése:

opcionális validációs szabályok generálása (pl. Neptun formátum)

OpenAPI / Swagger dokumentáció generálása

