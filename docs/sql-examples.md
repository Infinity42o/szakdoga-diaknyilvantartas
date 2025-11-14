# SQL példák (INSERT/UPDATE/SELECT)

Add-Content .\docs\sql-examples.md @'
## Gyors tesztek (MySQL Workbench / phpMyAdmin)

```sql
USE diaknyilvantartas;
SHOW TABLES;

SELECT COUNT(*) FROM hallgato;
SELECT COUNT(*) FROM tanar;
SELECT COUNT(*) FROM tantargy;
SELECT COUNT(*) FROM kurzus;
SELECT COUNT(*) FROM beiratkozas;

-- Statisztikai nézetek:
SELECT * FROM v_tantargy_atlag LIMIT 5;
SELECT * FROM v_szak_hallgatoszam;
SELECT * FROM v_hallgato_kredit LIMIT 5;
