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
