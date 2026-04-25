# Szakdolgozat – MySQL/MariaDB SQL → generált CRUD + statisztika alkalmazás

Ez a projekt egy **SQL-alapú kódgenerátor**. Egy MySQL/MariaDB adatbázisscriptből előállít egy működő, generikus CRUD alkalmazást:

- az SQL scriptből elkészíti a `schema.json` sémaleírást,
- felismeri a táblákat, oszlopokat, elsődleges kulcsokat, egyedi kulcsokat, indexeket és idegen kulcsokat,
- kezeli az `INSERT INTO` kezdeti adatokat,
- legenerál egy **Express + Sequelize** backend API-t,
- a generikus frontend pedig a `/api/meta` végpontból kapott metaadatok alapján rajzolja ki a táblákat, űrlapokat és statisztikákat.

A projekt célja: bemutatni, hogy egy relációs adatbázis sémájából automatikusan előállítható egy működő CRUD + statisztika alkalmazás.

---

## 1. Használt technológiák

### Backend / generátor

- Node.js
- Express
- Sequelize
- mysql2
- dotenv
- cors
- Handlebars

### Frontend

- Vite
- Vanilla JavaScript
- CSS
- Chart.js

### Adatbázis

- XAMPP MariaDB / MySQL
- MySQL Workbench vagy phpMyAdmin ellenőrzéshez

---

## 2. Projektmappák

Javasolt projektstruktúra:

```text
C:\projektek\szakdoga
├── db
│   ├── diaknyilvantartas.sql
│   ├── 01_ugyfel_crud.sql
│   ├── teszt-webshop.sql
│   └── teszt_halado.sql
│
├── generator
│   ├── src
│   │   ├── generate.js
│   │   ├── generate-backend.js
│   │   ├── parseSql.js
│   │   └── test-mysql2.js
│   │
│   ├── out
│   │   ├── schema.json
│   │   └── seed.sql
│   │
│   ├── backend
│   │   ├── app.js
│   │   ├── db
│   │   ├── models
│   │   └── routes
│   │
│   ├── .env
│   └── package.json
│
└── frontend
    ├── index.html
    ├── src
    │   ├── main.js
    │   ├── stats.js
    │   └── style.css
    └── package.json
```

---

## 3. Alapelv: SQL fájl + DB_NAME mindig párban jár

Másik adatbázis generálásánál **mindig három dolognak kell összhangban lennie**:

1. melyik SQL fájlt dolgozzuk fel,
2. milyen néven van importálva az adatbázis MariaDB-ben,
3. mi szerepel a `generator/.env` fájlban `DB_NAME` értékként.

Példa:

| SQL fájl | MariaDB adatbázis | `.env` DB_NAME |
|---|---|---|
| `db/diaknyilvantartas.sql` | `diaknyilvantartas` | `DB_NAME=diaknyilvantartas` |
| `db/01_ugyfel_crud.sql` | `teszt_ugyfel_crud3` | `DB_NAME=teszt_ugyfel_crud3` |
| `db/teszt-webshop.sql` | `teszt_webshop` | `DB_NAME=teszt_webshop` |
| `db/teszt_halado.sql` | `teszt_kurzus_halado` | `DB_NAME=teszt_kurzus_halado` |

Ha ezek nem egyeznek, akkor tipikus hiba lehet:

- `Unknown database`
- `Table ... doesn't exist`
- `Unknown column ... in field list`
- a frontend régi táblákat próbál lekérni

---

## 4. XAMPP / MariaDB indítása

Indítsd el a XAMPP Control Panelt, majd indítsd el:

```text
Apache
MySQL
```

PowerShell ellenőrzés:

```powershell
Test-NetConnection 127.0.0.1 -Port 3306
```

Jó eredmény:

```text
TcpTestSucceeded : True
```

---

## 5. Adatbázis importálása

### 5.1. Általános import séma

Ha egy SQL fájlt adott adatbázisnéven szeretnénk használni, akkor:

```powershell
& "C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -e "DROP DATABASE IF EXISTS ADATBAZIS_NEV; CREATE DATABASE ADATBAZIS_NEV CHARACTER SET utf8mb4 COLLATE utf8mb4_hungarian_ci;"
cmd /c ""C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -D ADATBAZIS_NEV < "C:\projektek\szakdoga\db\FAJLNEV.sql""
```

Ez akkor is működik, ha az SQL fájlban nincs külön `USE adatbazis;` utasítás.

### 5.2. Diáknyilvántartás importálása

```powershell
& "C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -e "DROP DATABASE IF EXISTS diaknyilvantartas; CREATE DATABASE diaknyilvantartas CHARACTER SET utf8mb4 COLLATE utf8mb4_hungarian_ci;"
cmd /c ""C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -D diaknyilvantartas < "C:\projektek\szakdoga\db\diaknyilvantartas.sql""
```

Ellenőrzés:

```powershell
& "C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -D diaknyilvantartas -e "SHOW TABLES;"
```

Várt fontos táblák:

```text
hallgato
tanar
tantargy
kurzus
beiratkozas
```

### 5.3. Webshop tesztadatbázis importálása

```powershell
& "C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -e "DROP DATABASE IF EXISTS teszt_webshop; CREATE DATABASE teszt_webshop CHARACTER SET utf8mb4 COLLATE utf8mb4_hungarian_ci;"
cmd /c ""C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -D teszt_webshop < "C:\projektek\szakdoga\db\teszt-webshop.sql""
```

### 5.4. Ügyfél CRUD tesztadatbázis importálása

```powershell
& "C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -e "DROP DATABASE IF EXISTS teszt_ugyfel_crud3; CREATE DATABASE teszt_ugyfel_crud3 CHARACTER SET utf8mb4 COLLATE utf8mb4_hungarian_ci;"
cmd /c ""C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -D teszt_ugyfel_crud3 < "C:\projektek\szakdoga\db\01_ugyfel_crud.sql""
```

### 5.5. Kurzus haladó tesztadatbázis importálása

```powershell
& "C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -e "DROP DATABASE IF EXISTS teszt_kurzus_halado; CREATE DATABASE teszt_kurzus_halado CHARACTER SET utf8mb4 COLLATE utf8mb4_hungarian_ci;"
cmd /c ""C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -D teszt_kurzus_halado < "C:\projektek\szakdoga\db\teszt_halado.sql""
```

### 5.6. Összes adatbázis ellenőrzése

```powershell
& "C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -e "SHOW DATABASES;"
```

A projekt szempontjából ezeknek kell látszaniuk:

```text
diaknyilvantartas
teszt_kurzus_halado
teszt_ugyfel_crud3
teszt_webshop
```

---

## 6. Generator `.env` beállítása

A backend a `generator/.env` fájlból olvassa ki az adatbázis-kapcsolatot.

Példa:

```env
PORT=3000
DB_HOST=127.0.0.1
DB_USER=root
DB_PASS=
DB_NAME=diaknyilvantartas
DB_PORT=3306
```

Másik adatbázis generálásakor a `DB_NAME` értékét át kell írni.

Példa webshophoz:

```env
DB_NAME=teszt_webshop
```

Fontos: ha a backend már futott, a `.env` módosítása után a Node backendet újra kell indítani.

---

## 7. Generator telepítése

```powershell
cd C:\projektek\szakdoga\generator
npm install
```

Adatbázis-kapcsolat tesztelése:

```powershell
npm run db:ping
```

Megjegyzés: a `db:ping` teszt eredetileg tartalmazhatott konkrét próbakérdezést, például ügyfél táblára. Ha másik adatbázist használsz, és csak ez a próbakérdezés hibázik, de a `SHOW TABLES` jó, akkor maga a DB-kapcsolat működik.

---

## 8. Generálási folyamat

A generálás két fő lépésből áll:

1. SQL fájl → `out/schema.json`
2. `schema.json` → generált backend

### 8.1. SQL → `schema.json`

Példa diáknyilvántartáshoz:

```powershell
cd C:\projektek\szakdoga\generator
npm run parse:dump -- ..\db\diaknyilvantartas.sql .\out
```

Kimenet:

```text
generator/out/schema.json
generator/out/seed.sql
```

A `schema.json` tartalmazza:

- a táblák nevét,
- oszlopokat,
- típusokat,
- `primaryKey` információt,
- `autoIncrement` információt,
- idegen kulcsokat,
- `ENUM` értékeket,
- statisztikához használható dimenziókat és metrikákat.

phpMyAdmin dumpoknál az `AUTO_INCREMENT` gyakran nem a `CREATE TABLE` oszlopsorban van, hanem későbbi `ALTER TABLE ... MODIFY ... AUTO_INCREMENT` utasításban. A `generate.js` ezt is kezeli.

Ellenőrzés diáknyilvántartásnál:

```powershell
node -e "const s=require('./out/schema.json'); console.log(s.tables.find(t=>(t.table||t.name)==='hallgato').columns.find(c=>c.name==='id'))"
```

Jó eredmény:

```js
autoIncrement: true
```

### 8.2. `schema.json` → generált backend

```powershell
npm run gen:backend
```

Ez létrehozza/frissíti:

```text
generator/backend/app.js
generator/backend/db/index.js
generator/backend/models/*.js
generator/backend/routes/*.js
generator/backend/routes/meta.js
generator/backend/routes/stats.js
```

### 8.3. Backend indítása

```powershell
npm run start:backend
```

Jó indulás:

```text
Megy, API listening on port 3000
```

Backend ellenőrzés:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

Vagy böngészőben:

```text
http://localhost:3000/health
```

---

## 9. Frontend indítása

Új PowerShell ablakban:

```powershell
cd C:\projektek\szakdoga\frontend
npm install
npm run dev
```

A Vite általában ezt adja:

```text
http://localhost:5173
```

A frontend API hívásai a backend felé mennek:

```text
http://localhost:3000/api
```

---

## 10. Teljes használati sorrend egy adatbázisnál

Példa: `diaknyilvantartas`.

### 10.1. MySQL indítása

XAMPP-ben MySQL legyen elindítva.

### 10.2. Adatbázis import

```powershell
& "C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -e "DROP DATABASE IF EXISTS diaknyilvantartas; CREATE DATABASE diaknyilvantartas CHARACTER SET utf8mb4 COLLATE utf8mb4_hungarian_ci;"
cmd /c ""C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -D diaknyilvantartas < "C:\projektek\szakdoga\db\diaknyilvantartas.sql""
```

### 10.3. `.env` beállítás

`generator/.env`:

```env
DB_NAME=diaknyilvantartas
```

### 10.4. Parser futtatás

```powershell
cd C:\projektek\szakdoga\generator
npm run parse:dump -- ..\db\diaknyilvantartas.sql .\out
```

### 10.5. Backend generálás

```powershell
npm run gen:backend
```

### 10.6. Backend indítás

```powershell
npm run start:backend
```

### 10.7. Frontend indítás

Másik PowerShell ablakban:

```powershell
cd C:\projektek\szakdoga\frontend
npm run dev
```

Böngésző:

```text
http://localhost:5173
```

---

## 11. Másik adatbázis generálása

Ez a legfontosabb rész, ha ugyanazzal a rendszerrel másik SQL adatbázist akarunk kipróbálni.

### 11.1. Lépések röviden

Másik adatbázisra váltáskor mindig ezt kell csinálni:

1. importáld az új SQL-t MariaDB-be,
2. írd át a `generator/.env` fájlban a `DB_NAME` értéket,
3. futtasd a parsert az új SQL fájlra,
4. generáld újra a backendet,
5. indítsd újra a backendet,
6. frissítsd a frontendet a böngészőben.

### 11.2. Példa: webshop generálása

#### 1. Import

```powershell
& "C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -e "DROP DATABASE IF EXISTS teszt_webshop; CREATE DATABASE teszt_webshop CHARACTER SET utf8mb4 COLLATE utf8mb4_hungarian_ci;"
cmd /c ""C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -D teszt_webshop < "C:\projektek\szakdoga\db\teszt-webshop.sql""
```

#### 2. `.env`

```env
DB_NAME=teszt_webshop
```

#### 3. Parser

```powershell
cd C:\projektek\szakdoga\generator
npm run parse:dump -- ..\db\teszt-webshop.sql .\out
```

#### 4. Backend generálás

```powershell
npm run gen:backend
```

#### 5. Backend újraindítás

Ha fut régi Node backend:

```powershell
taskkill /F /IM node.exe
```

Utána:

```powershell
npm run start:backend
```

#### 6. Frontend frissítés

A frontend általában maradhat futva:

```powershell
cd C:\projektek\szakdoga\frontend
npm run dev
```

Böngészőben frissítsd az oldalt:

```text
http://localhost:5173
```

### 11.3. Példa: ügyfél CRUD generálása

```powershell
& "C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -e "DROP DATABASE IF EXISTS teszt_ugyfel_crud3; CREATE DATABASE teszt_ugyfel_crud3 CHARACTER SET utf8mb4 COLLATE utf8mb4_hungarian_ci;"
cmd /c ""C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -D teszt_ugyfel_crud3 < "C:\projektek\szakdoga\db\01_ugyfel_crud.sql""
```

`generator/.env`:

```env
DB_NAME=teszt_ugyfel_crud3
```

Generálás:

```powershell
cd C:\projektek\szakdoga\generator
npm run parse:dump -- ..\db\01_ugyfel_crud.sql .\out
npm run gen:backend
npm run start:backend
```

### 11.4. Példa: kurzus haladó generálása

```powershell
& "C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -e "DROP DATABASE IF EXISTS teszt_kurzus_halado; CREATE DATABASE teszt_kurzus_halado CHARACTER SET utf8mb4 COLLATE utf8mb4_hungarian_ci;"
cmd /c ""C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -D teszt_kurzus_halado < "C:\projektek\szakdoga\db\teszt_halado.sql""
```

`generator/.env`:

```env
DB_NAME=teszt_kurzus_halado
```

Generálás:

```powershell
cd C:\projektek\szakdoga\generator
npm run parse:dump -- ..\db\teszt_halado.sql .\out
npm run gen:backend
npm run start:backend
```

### 11.5. Fontos: a backend mindig az aktuális `schema.json` alapján generálódik

Ha átírod a `.env` fájlt, de nem futtatod újra ezt:

```powershell
npm run parse:dump -- ..\db\megfelelo.sql .\out
npm run gen:backend
```

akkor a backend még a régi táblákra fog route-okat és modelleket tartalmazni.

Ez okozhat ilyen hibákat:

```text
Table ... doesn't exist
Unknown column ... in field list
```

---

## 12. REST API végpontok

A generált backend minden táblához automatikusan létrehoz CRUD végpontokat.

Példa `hallgato` táblára:

| Művelet | Végpont |
|---|---|
| Lista | `GET /api/hallgato` |
| Egy rekord | `GET /api/hallgato/:id` |
| Új rekord | `POST /api/hallgato` |
| Módosítás | `PUT /api/hallgato/:id` |
| Törlés | `DELETE /api/hallgato/:id` |

Kompozit kulcsos táblánál a route több paramétert használ.

Példa:

```text
/api/beiratkozas/:hallgato_id/:kurzus_id
```

### Meta végpont

```text
GET /api/meta
```

Ez adja vissza a frontendnek a táblák és mezők leírását.

### Generikus statisztika végpont

```text
GET /api/stats/aggregate?table=...&groupBy=...&agg=...&field=...&excludeNull=1
```

Támogatott aggregációk:

```text
count
sum
avg
min
max
```

Példa:

```text
http://localhost:3000/api/stats/aggregate?table=hallgato&groupBy=szak&agg=count&excludeNull=1
```

---

## 13. Frontend funkciók

A frontend generikus, tehát nem egy konkrét adatbázisra van fixen ráírva.

A `/api/meta` alapján:

- létrehozza a táblák füleit,
- listázza a rekordokat,
- űrlapot épít új rekordhoz és szerkesztéshez,
- FK mezőknél legördülőt próbál használni,
- ENUM mezőknél legördülőt használ,
- BOOLEAN mezőknél checkboxot használ,
- ID / auto increment mezőket új rekordnál nem kell kézzel megadni,
- a statisztika nézetben táblát, dimenziót, metrikát és aggregálást lehet választani.

---

## 14. Statisztika működése

A statisztika oldal szintén metaadat-alapú.

Fő működés:

- a táblák és oszlopok listája a `/api/meta` végpontból jön,
- dimenzió = csoportosító mező,
- metrika = numerikus mező,
- aggregáció = `count`, `sum`, `avg`, `min`, `max`,
- a diagramot Chart.js rajzolja.

FK csoportosítás esetén a frontend megpróbál emberibb címkét megjeleníteni.

Példa:

```text
hallgato_id = 4
```

helyett:

```text
Varga Réka (#4)
```

Az ID megjelenítése a statisztika oldalon külön kapcsolható.

---

## 15. Gyakori hibák és megoldások

### 15.1. `EADDRINUSE: address already in use :::3000`

A 3000-es porton már fut egy Node backend.

Megoldás:

```powershell
taskkill /F /IM node.exe
npm run start:backend
```

### 15.2. `ECONNREFUSED 127.0.0.1:3306`

A MySQL/MariaDB nem fut.

Megoldás:

- XAMPP Control Panelben indítsd el a MySQL-t,
- ellenőrizd:

```powershell
Test-NetConnection 127.0.0.1 -Port 3306
```

### 15.3. `Unknown database`

A `.env` fájlban olyan `DB_NAME` van, ami nincs létrehozva MariaDB-ben.

Ellenőrzés:

```powershell
& "C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -e "SHOW DATABASES;"
```

### 15.4. `Table ... doesn't exist`

A backend olyan táblát keres, ami nincs az aktuális adatbázisban.

Leggyakoribb okok:

- nem jó a `.env` `DB_NAME`,
- rossz SQL fájlból készült a `schema.json`,
- nem futott újra a `npm run gen:backend`,
- régi backend fut még a háttérben.

Megoldás:

```powershell
taskkill /F /IM node.exe
npm run parse:dump -- ..\db\megfelelo.sql .\out
npm run gen:backend
npm run start:backend
```

### 15.5. `Unknown column ... in field list`

A generált Sequelize model más oszlopokat tartalmaz, mint az aktuális adatbázis.

Megoldás: ugyanaz, mint az előzőnél. A SQL fájl, a `schema.json`, a generált backend és a `.env` ugyanarra az adatbázisra mutasson.

### 15.6. `hallgato.id cannot be null`

Az `AUTO_INCREMENT` mező nem került át rendesen a `schema.json` → Sequelize model láncba.

Ellenőrzés:

```powershell
node -e "const s=require('./out/schema.json'); console.log(s.tables.find(t=>(t.table||t.name)==='hallgato').columns.find(c=>c.name==='id'))"
```

Jó esetben:

```js
autoIncrement: true
```

Utána ellenőrizhető a generált model is:

```powershell
Get-Content .\backend\models\hallgato.js | Select-String -Pattern '"id":' -Context 0,10
```

Jó esetben az `id` alatt szerepel:

```js
autoIncrement: true,
```

### 15.7. `Table ... doesn't exist in engine`

Ez XAMPP/MariaDB adatfájl-sérülésre utalhat.

Biztonságos reset menete:

1. XAMPP-ban állítsd le a MySQL-t.
2. PowerShell:

```powershell
cd C:\xampp\mysql
Rename-Item .\data .\data_broken
Copy-Item .\backup .\data -Recurse
```

3. XAMPP-ban indítsd újra a MySQL-t.
4. Importáld újra az SQL fájlokat.

---

## 16. Miért generikus a rendszer?

A backend és a frontend nem egyetlen konkrét adatbázisra van kézzel ráírva.

A folyamat:

```text
SQL fájl
  ↓
schema.json
  ↓
generált Sequelize modellek + Express route-ok
  ↓
/api/meta
  ↓
generikus frontend
```

Ezért másik adatbázis használatához jellemzően elég:

1. új SQL fájlt importálni,
2. `.env` DB_NAME-et átírni,
3. `parse:dump` futtatása az új SQL-re,
4. `gen:backend` futtatása,
5. backend újraindítása,
6. frontend frissítése.

A frontendnek normál esetben nem kell táblaspecifikus módosítás, mert a táblalistát, mezőket, típusokat és kapcsolatok nagy részét a `/api/meta` alapján kapja meg.

---

## 17. Legfontosabb parancsok összefoglalva

### Backend / generator

```powershell
cd C:\projektek\szakdoga\generator

npm install

npm run parse:dump -- ..\db\diaknyilvantartas.sql .\out
npm run gen:backend
npm run start:backend
```

### Frontend

```powershell
cd C:\projektek\szakdoga\frontend

npm install
npm run dev
```

### MySQL ellenőrzés

```powershell
Test-NetConnection 127.0.0.1 -Port 3306
& "C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -e "SHOW DATABASES;"
```

---

## 18. Rövid demonstrációs forgatókönyv

Egy bemutatón a következő lépések érdemesek:

1. MySQL fut XAMPP-ben.
2. `diaknyilvantartas` adatbázis importálva.
3. `generator/.env`:

```env
DB_NAME=diaknyilvantartas
```

4. Parser:

```powershell
npm run parse:dump -- ..\db\diaknyilvantartas.sql .\out
```

5. Backend generálás:

```powershell
npm run gen:backend
```

6. Backend indítás:

```powershell
npm run start:backend
```

7. Frontend indítás:

```powershell
cd C:\projektek\szakdoga\frontend
npm run dev
```

8. Böngészőben:
   - táblák listázása,
   - új rekord beszúrása,
   - rekord szerkesztése,
   - rekord törlése,
   - statisztika lekérdezése.

Másik adatbázis bemutatása esetén:

1. importálni az új DB-t,
2. `.env` `DB_NAME` átírás,
3. `parse:dump` az új SQL fájlra,
4. `gen:backend`,
5. backend újraindítás,
6. frontend frissítés.

