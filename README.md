# Adatbázis-alapú alkalmazások automatikus generálása – Szakdolgozat

## Áttekintés

## Aktuális állapot: 1–3. pont kész

(1) Környezet előkészítése (Windows 11, XAMPP/MariaDB, Node.js, VS Code)
(2) Adatbázis-séma + bemeneti script (db/diaknyilvantartas.sql) importálható
(3) Generátor: SQL→JSON parser + mintagenerálás, tesztekkel

## 1) Környezet előkészítése – röviden

XAMPP (MariaDB/MySQL + phpMyAdmin) – indítsd a MySQL szolgáltatást
Node.js (LTS) – ellenőrzés: node -v, npm -v
Visual Studio Code – szerkesztéshez
Windows Terminal / PowerShell – parancsok futtatásához

## 2) Adatbázis séma – import

### Eszközök: phpMyAdmin (javasolt) vagy MySQL Workbench

### phpMyAdmin (egyszerű)

XAMPP Control Panel → MySQL Start
-Nyisd meg: http://localhost/phpmyadmin/ → Importálás fül
-Válaszd: db/diaknyilvantartas.sql → Go
-Megjegyzés: a script tartalmazhat USE diaknyilvantartas sort. Ha a dump nem hoz létre DB-t, előtte hozd létre vagy válaszd ki.

## MySQL Workbench
File → Run SQL Script… → válaszd a db/diaknyilvantartas.sql fájlt → futtasd.

## Gyors ellenőrző lekérdezések
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

## 3) Generátor

### Mit tud a parser (generator/src/parseSql.js)?
CREATE + ALTER TABLE feldolgozás (nem csak CREATE-ben definiált kulcsokat lát)
PK/FK (összetett kulcsok is: több oszlop)
UNIQUE / INDEX (névvel vagy név nélkül)
ENUM értékek kigyűjtése
DEFAULT és ON UPDATE értékek felismerése
COMMENT (oszlop megjegyzés) kiolvasása
VIEW-k kizárása a sémából
DB név: CREATE DATABASE / USE alapján, fallback a bemeneti fájlnévből

### Parancsok
A következőket a generator/ mappából kell futtatni:

### 1) Dumpból sémát olvas (nincs szükség élő DB-re):
npm run parse
### kimenet: generator/out/schema-only.json

### 2) Élő DB-ből introspektál INFORMATION_SCHEMA alapján:
npm run introspect
### kimenet: generator/src/out/schema.json
### .env minta: generator/.env.example (másold .env-re és töltsd ki)

### 3) Generálás (séma → kimeneti fájlok/minták):
npm run generate
### kimenet: generator/out/schema.json + generator/out/samples/HELLO.txt

### 4) Gyors egészség-ellenőrzés az élő DB-n:
npm run db:ping

### Gyors parancsok – bárhonnan (PowerShell): 
cd generator; npm run introspect   # élő DB → schema.json
cd generator; npm run parse        # dump → schema-only.json
cd generator; npm run generate     # out/schema.json + samples/HELLO.txt
cd generator; npm run db:ping      # egészség-ellenőrzés

### Fő fájlok
-generator/src/parseSql.js – SQL → JSON parser
-generator/src/generate.js – generálási belépő
-generator/src/introspect.js – élő DB introspekció
-generator/src/test-parse.js + generator/fixtures/*.sql – parser tesztek
-generator/templates/hello.hbs – minta sablon

### Tesztelés

A parserre van egy pici, célzott tesztcsomag. Futtatás:
cd generator
npm run test:parser
# várható kimenet: "test-parse: minden OK"

### A tesztek lefedik:
-összetett PK/FK eseteket,
-UNIQUE / INDEX szintaxist,
-ENUM, DEFAULT, ON UPDATE, COMMENT kiolvasását.

### Beállítás (introspect)
A generator/.env.example mintát másold .env néven és töltsd ki ha üres lenne:

DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=diaknyilvantartas
DB_PORT=3306

### Git beállítások
.gitignore: a generált kimenetek kimaradnak a verziókezelésből (tiszta history, kevesebb konfliktus).
.env ignorálva van; a .env.example verziózott minta.
.gitattributes: normalizált soremelés (CRLF/LF) – egységesítés különböző eszközök között.

## Tesztelt környezet

OS: Windows 11 (22H2/23H4)
DB: XAMPP (MariaDB), phpMyAdmin; kliens: MySQL Workbench
Shell: Windows Terminal / PowerShell
Node.js: LTS (tesztelve v22-vel is)

## Következő lépések (terv)
-Generált kimenetek bővítése (TypeScript interfészek, ORM modellek, migrációk, OpenAPI/Swagger, seedek)
-Validációk/kommentek átvezetése a generált kódba
-Több sablon (REST controller, service, DAO), projektsablonok

## Ha bármi elakad, a npm run test:parser az első gyors ellenőrzés, hogy a parse-olás rendben van-e.

## következő körben megtervezem, hogy a generate milyen konkrét kimeneteket állítson elő (TS interfészek, Sequelize/TypeORM modellek, OpenAPI-séma, seedek), és melyik mezőkből milyen komment/validáció legyen.
## Backend generálás az alábbi terv szerint. Javaslatom: alapértelmezettként Express + Sequelize (illeszkedik a mostani mysql2/MariaDB környezethez), de a sablonokat úgy írom meg, hogy később könnyen váltható legyen TypeORM vagy Prisma irányba.
