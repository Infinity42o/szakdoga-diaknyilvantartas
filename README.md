# Adatbázis-alapú alkalmazások automatikus generálása – Szakdolgozat

**Fókusz (jelen állapot):** 1–2. pont teljesítve
- (1) Környezet előkészítése (Windows 11, XAMPP/MySQL, Node.js, VS Code, mappastruktúra)
- (2) Adatbázis séma + bemeneti script (`diaknyilvantartas.sql`) létrehozva és importálható

## 1) Környezet előkészítése – összefoglaló
- **XAMPP** (MySQL/MariaDB + phpMyAdmin) – MySQL szolgáltatás indítása
- **Node.js (LTS)** – `node -v`, `npm -v` ellenőrzés
- **Visual Studio Code** – fejlesztéshez
- **PowerShell/Terminal** – parancsok futtatásához

## 2) Adatbázis séma – importálás
**Eszköz:** phpMyAdmin (XAMPP), vagy MySQL Workbench

### phpMyAdmin (javasolt, egyszerű)
1. Indítsd a **MySQL**-t a XAMPP Control Panelben.
2. Nyisd meg: `http://localhost/phpmyadmin/` → **Importálás** fül.
3. Válaszd a `db/diaknyilvantartas.sql` fájlt → **Go**.

> A script tartalmazhat `USE diaknyilvantartas`-t. Ha a dump nem hoz létre adatbázist, előtte készítsd el vagy válassz ki egyet.

### MySQL Workbench
- **File → Run SQL Script…** → `db/diaknyilvantartas.sql` → futtatás.

### Gyors ellenőrző lekérdezések
```sql
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


## Tesztelt verziók
- **OS:** Windows 11 (22H2/23H2)
- **DB környezet:** XAMPP (MySQL/MariaDB), phpMyAdmin; MySQL Workbench
- **MySQL/MariaDB:** aktuális XAMPP-alapú MariaDB + MySQL Workbench klienssel tesztelve
- **Shell:** Windows Terminal / PowerShell

## Megjegyzés a `CHECK` megkötésről
Bizonyos MariaDB/MySQL verziókban a `CHECK` constraint viselkedése eltérhet.  
Ha új környezetbe importálás után a jegy (1..5) korlátozás nem érvényesül,
futtasd egyszer az alábbi parancsot:

```sql
ALTER TABLE beiratkozas
  ADD CONSTRAINT chk_jegy CHECK (jegy IS NULL OR (jegy BETWEEN 1 AND 5));
Add-Content .\README.md @'
---

## Állapot – v0.2 (Pont 1–3 kész)

**Kész:**
- (1) Környezet + mappastruktúra
- (2) MySQL séma + mintaadatok (`db/diaknyilvantartas.sql`)
- (3) Generátor alapok: SQL→JSON parser (PK/FK, UNIQUE, INDEX, ENUM, VIEW-k kizárva) + Handlebars próbagenerálás

**Hogyan futtasd a generátort:**
```bash
cd generator
npm run generate -- --input ../db/diaknyilvantartas.sql --out ./out
# Eredmény: out/schema.json + out/samples/HELLO.txt
Állapot – v0.2 (1–3. pont kész)” blokk
„How to run” (generator) egy háromsoros kódblokkban
Állapot: KÉSZ.
Parser: CREATE + ALTER (PK/FK/UNIQUE/INDEX), ENUM, VIEW kizárás ✅
Kimenet: out/schema.json, out/samples/HELLO.txt ✅
DB név: USE vagy fájlnévből fallback ✅
Fájlok: generator/src/parseSql.js, generator/src/generate.js, generator/templates/hello.hbs
Futtatás: cd generator && npm run generate -- --input ../db/diaknyilvantartas.sql --out ./out