Oké, nézzük át teljesen, rendszerezve. Az alábbi összefoglaló a sémát, a kapcsolatok logikáját, a nézetek működését, az indexelést, az adatintegritást, a mintaadatokat, tipikus lekérdezéseket és néhány fejlesztési javaslatot is tartalmazza.

1) Cél és fogalmi modell

Téma: egy egyetemi nyilvántartás (diákok–tantárgyak–kurzusok–oktatók–beiratkozások).
Fő entitások:

hallgato: diákok (Neptun-kód, név, szak, évfolyam, stb.)

tantargy: tárgytörzs (kód, név, kredit, aktív)

tanar: oktatók (név, tanszék, e-mail)

kurzus: konkrét kurzusok (tantárgy + tanár + félév + típus + terem + kapacitás)

beiratkozas: kapcsolat hallgató és kurzus között, időbélyeggel és (opcionális) jeggyel

Kapcsolatok (ER szint):

hallgato (1) — (N) beiratkozas (N) — (1) kurzus

kurzus (N) — (1) tantargy

kurzus (N) — (1) tanar

2) Fizikai séma: táblák és oszlopok
2.1 hallgato

id PK (INT UNSIGNED, AUTO_INCREMENT)

neptun CHAR(6) UNIQUE

nev VARCHAR(120) NOT NULL

nem ENUM('no','ferfi','egyeb') NULL

szak VARCHAR(80) NOT NULL

evfolyam TINYINT UNSIGNED NOT NULL

szuldatum DATE NULL

email VARCHAR(120) NULL UNIQUE

Charset/Collation: utf8mb4 / hungarian_ci

Megjegyzések:

A neptun és email egyedisége biztosított. MariaDB/MySQL alatt több NULL lehet ugyanazon UNIQUE indexben – ez itt nem gond, mert e-mail opcionális.

nem és evfolyam értékkészlet kontrollált; evfolyam nem lehet negatív (UNSIGNED).

2.2 tanar

id PK (INT UNSIGNED, AUTO_INCREMENT)

nev VARCHAR(120) NOT NULL

tanszek VARCHAR(120) NOT NULL

email VARCHAR(120) NOT NULL UNIQUE

Charset/Collation: utf8mb4 / hungarian_ci

2.3 tantargy

id PK (INT UNSIGNED, AUTO_INCREMENT)

kod VARCHAR(16) NOT NULL UNIQUE (pl. PROG1)

nev VARCHAR(160) NOT NULL

kredit TINYINT UNSIGNED NOT NULL

aktiv TINYINT(1) NOT NULL DEFAULT 1

Charset/Collation: utf8mb4 / hungarian_ci

2.4 kurzus

id PK (INT UNSIGNED, AUTO_INCREMENT)

tantargy_id FK → tantargy(id)

tanar_id FK → tanar(id)

felev VARCHAR(16) NOT NULL (pl. 2024-25-1)

tipus ENUM('eloadas','gyakorlat','labor') NOT NULL DEFAULT 'eloadas'

kapacitas SMALLINT UNSIGNED DEFAULT 100

terem VARCHAR(32) NULL

Charset/Collation: utf8mb4 / hungarian_ci

Megjegyzések FK-kről:

fk_kurzus_tantargy és fk_kurzus_tanar ON UPDATE CASCADE, DELETE szabály nincs megadva ⇒ törléskor az alapértelmezett (RESTRICT/NO ACTION) érvényes. Vagyis amíg létezik rájuk hivatkozó kurzus, nem törölhető a tantárgy/tanár.

2.5 beiratkozas (kapcsolótábla)

Összetett PK: (hallgato_id, kurzus_id) ⇒ egy hallgató egy kurzusba legfeljebb egyszer iratkozhat be.

hallgato_id FK → hallgato(id) ON DELETE CASCADE ON UPDATE CASCADE

kurzus_id FK → kurzus(id) ON DELETE CASCADE ON UPDATE CASCADE

felvet_datum DATETIME NOT NULL DEFAULT current_timestamp()

jegy TINYINT UNSIGNED NULL (várható érték: 1..5, de nincs explicit CHECK)

Indexek: PK mellett külön index ix_beiratkozas_kurzus a kurzus_id-re (jó a kurzus felől történő lekérdezésekhez).

Megjegyzések:

CASCADE törlés: ha egy hallgatót törölnek, a hozzá tartozó beiratkozások is törlődnek; ha egy kurzust törölnek, a beiratkozások is törlődnek.

Jegy opcionális (NULL = még nincs értékelve).

3) Nézetek (VIEW-k)
3.1 v_hallgato_kredit

Definíció (röviden): hallgatónként összeadja a teljesített krediteket, ahol a beiratkozáshoz tartozó jegy nem NULL és ≥ 2.

Forrás: hallgato LEFT JOIN beiratkozas LEFT JOIN kurzus LEFT JOIN tantargy

Képlet: SUM(CASE WHEN b.jegy IS NOT NULL AND b.jegy >= 2 THEN tt.kredit ELSE 0 END)

Eredmény oszlopok: hallgato_id, nev, teljesitett_kredit

Megjegyzések:

A LEFT JOIN miatt azok a hallgatók is benne vannak, akiknek még nincs beiratkozásuk – náluk az összeg 0 lesz (a CASE miatt).

Típus: a dumpban DECIMAL(25,0)-ként szerepel a placeholder táblánál; a view ténylegesen a SUM eredményéből adódó numerikus típust adja vissza (MariaDB/ MySQL DECIMAL/NUMERIC).

3.2 v_szak_hallgatoszam

Definíció: hallgato táblából szakonkénti darabszám (COUNT(*)), oszlopok: szak, hallgatoszam.

3.3 v_tantargy_atlag

Definíció: tantárgyankénti átlagjegy (csak ahol van nem-NULL jegy).

JOIN: tantargy → kurzus → beiratkozas

WHERE: b.jegy IS NOT NULL

GROUP BY: tantárgy szint

Oszlopok: tantargy_id, kod, nev, atlagjegy (AVG(TINYINT) ⇒ DECIMAL(7,4))

Megjegyzés: csak azok a tantárgyak jelennek meg, ahol legalább egy értékelt beiratkozás van.

4) Indexelés összefoglaló

PK-k minden törzstáblán (id), a kapcsolótáblán összetett PK.

UNIQUE: hallgato(neptun), hallgato(email), tanar(email), tantargy(kod).

FK-kra külön indexek vannak (kurzus.tantargy_id, kurzus.tanar_id, beiratkozas.kurzus_id).
A beiratkozas összetett PK-jának első tagja a hallgato_id, tehát a hallgató felőli lekérdezésekhez is jó index áll rendelkezésre.

Lehetséges kiegészítő indexek (opcionális):

kurzus(felev) – félév szerinti listázás gyorsul.

beiratkozas(felvet_datum) – idősoros lekérdezésekhez.

hallgato(szak), hallgato(evfolyam) – gyakori statisztikák esetén.

5) Integritási szabályok és üzleti logika

Egyediség: Neptun-kód és e-mail egyedi (hallgató), e-mail egyedi (tanár), tárgykód egyedi.

Kötelező–opcionális mezők: név, szak, évfolyam kötelező (hallgato); oktatói e-mail kötelező; kurzusnál tárgy/tanár/felev/tipus kötelező; jegy opcionális.

Értékkészlet ellenőrzés:

nem és tipus ENUM-okkal korlátozott.

jegy nincs explicit CHECK-kel korlátozva 1..5 közé (UNSIGNED miatt negatív nem lehet, de 6..255 sem kizárt technikailag).

Kapacitás: kurzus.kapacitas csak tárolva van, nem ellenőrzött a beiratkozások számához képest (nincs trigger/constraint).

Törlési szabályok:

Hallgató/kurzus törlése kaskádszerűen törli a hozzájuk tartozó beiratkozásokat.

Tantárgy/tanár törlése blokkolt, ha van rájuk hivatkozó kurzus.

6) Mintaadatok (kivonat, logika)

Hallgatók: 1–10 és 13-as ID; több szak (Programtervező informatikus, Gazdaságinformatikus, Mérnökinformatikus).

Tantárgyak: PROG1, PROG2, ADT1, ADT2, MATH1, MATH2, STAT1, WEB1 (kreditek 3–5).

Kurzusok: tantárgy + tanár + félév; van előadás/gyakorlat/labor; tipikusan 2024-25-1 és 2024-25-2 félévek.

Beiratkozások: 2024 őszi és 2025 tavaszi dátumok, néhány jeggyel (2–5), néhány NULL (még nincs értékelve).

Példa: hallgató 13 (Teszt Elek): PROG1-re beiratkozva és jegyet kapott (5), valamint egy 2025-09-29-es beiratkozása kurzus 3-ra, jegy még NULL.

7) Tipikus lekérdezések (SQL minták)

7.1 Hallgató teljesített kreditjei (VIEW nélkül is):

SELECT h.id, h.nev,
       SUM(CASE WHEN b.jegy IS NOT NULL AND b.jegy >= 2 THEN t.kredit ELSE 0 END) AS teljesitett_kredit
FROM hallgato h
LEFT JOIN beiratkozas b ON b.hallgato_id = h.id
LEFT JOIN kurzus k ON k.id = b.kurzus_id
LEFT JOIN tantargy t ON t.id = k.tantargy_id
GROUP BY h.id, h.nev;


7.2 Tantárgyak átlagjegye (VIEW nélkül):

SELECT t.id, t.kod, t.nev, AVG(b.jegy) AS atlagjegy
FROM tantargy t
JOIN kurzus k   ON k.tantargy_id = t.id
JOIN beiratkozas b ON b.kurzus_id = k.id
WHERE b.jegy IS NOT NULL
GROUP BY t.id, t.kod, t.nev;


7.3 Egy kurzus létszáma és telítettsége:

SELECT k.id, t.kod, t.nev, k.felev, k.tipus,
       COUNT(b.hallgato_id) AS beiratkozok,
       k.kapacitas,
       ROUND(100 * COUNT(b.hallgato_id) / k.kapacitas, 1) AS toltottseg_szazalek
FROM kurzus k
JOIN tantargy t ON t.id = k.tantargy_id
LEFT JOIN beiratkozas b ON b.kurzus_id = k.id
GROUP BY k.id, t.kod, t.nev, k.felev, k.tipus, k.kapacitas;


7.4 Egy hallgató indexszerű átlagának becslése (egyszerű súlyozatlan, csak jegyekből):

SELECT h.id, h.nev, AVG(b.jegy) AS atlag
FROM hallgato h
JOIN beiratkozas b ON b.hallgato_id = h.id
WHERE b.jegy IS NOT NULL
GROUP BY h.id, h.nev;


(Ha kredit-súlyozott átlag kell: SUM(b.jegy * t.kredit) / SUM(t.kredit) a tantargy becsatolásával.)

7.5 Hallgató összes kurzusa félév szerint:

SELECT h.nev, t.kod, t.nev AS tantargy_nev, k.felev, k.tipus, b.felvet_datum, b.jegy
FROM beiratkozas b
JOIN hallgato h ON h.id = b.hallgato_id
JOIN kurzus k   ON k.id = b.kurzus_id
JOIN tantargy t ON t.id = k.tantargy_id
WHERE h.neptun = 'ABC123'
ORDER BY k.felev, t.kod;


7.6 Szakonkénti hallgatószám:

SELECT * FROM v_szak_hallgatoszam;

8) Teljesítmény és skálázás – rövid értékelés

A jelenlegi indexkészlet a tipikus join-okhoz megfelelő.

Nagy táblaméretek esetén érdemes:

kurzus(felev) indexet felvenni (félév-listák gyorsak).

beiratkozas(felvet_datum) indexet, ha kronológiai szűrés gyakori.

Esetleg kompozit indexeket a leggyakoribb szűrésekhez (pl. beiratkozas(hallgato_id, jegy) vagy kurzus(tantargy_id, felev)).

9) Adatminőség és üzleti szabályok – javaslatok

Jegy tartományának korlátozása (1..5): MariaDB-ben CHECK működhet újabb verziókon, de gyakran triggerrel vagy alkalmazáslogikával érdemes védeni:

ALTER TABLE beiratkozas
  ADD CONSTRAINT chk_jegy_range CHECK (jegy BETWEEN 1 AND 5);


Kapacitás betartatása: trigger vagy alkalmazásoldali ellenőrzés (beiratkozás előtt számolni a létszámot).

Félév formátumának szabályozása: külön felev törzstábla (id, ev_kezdet, ev_veg, szemeszter), és kurzus.felev_id FK – ez besepri a formátumhibákat.

E-mail formátum: alkalmazásban validáld; DB-ben max. hossz és UNIQUE megvan.

Törlési szabályok finomítása: ha megengedett a tanár/tantárgy törlése, döntsd el a kívánt viselkedést (CASCADE vs. SET NULL vs. RESTRICT). Jelenleg a biztonságos RESTRICT érvényes.

10) Jogosultság és biztonság

A view-k SQL SECURITY DEFINER-rel és DEFINER=root@localhost-tal futnak.

Ez azt jelenti, hogy a view az alkotó (root) jogosultságaival értékelődik ki.

Éles környezetben érdemes a definert egy nem-root, korlátozott szerepkörű felhasználóra cserélni (pl. app_reader), és célzott SELECT jogokat adni az alap-táblákra.

11) Motor, karakterkódolás, dump meta

Dump: phpMyAdmin 5.2.1, DB szerver: MariaDB 10.4.32, PHP 8.2.12.

SET NAMES utf8mb4, több tábla utf8mb4_hungarian_ci – jó választás magyar rendezéshez/ékezetkezeléshez.

Engine: a legtöbb táblánál InnoDB explicit; a beiratkozas CREATE nem jelöli külön, de FK-k miatt InnoDB szükséges (a szerver alapértelmezettje valószínűleg InnoDB). Érdemes explicit rögzíteni:

CREATE TABLE beiratkozas (...) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

12) Normalizáció – rövid értékelés

A séma 3NF-nek megfelelő: nincsen redundáns adattárolás, kulcsok normálisak.

Kisebb javítási lehetőség: a kurzus.felev normalizálása idegen kulccsá; esetleg terem is külön törzsbe, ha sok metaadata lesz.

13) Gyakori használati esetek – mit tud a séma?

Hallgatói előrehaladás (teljesített kredit és tantárgyak).

Tantárgyak minőségmutatói (átlagjegy).

Oktatói leterheltség (hány kurzust visz).

Kurzustelítettség/kapacitás.

Szak- és évfolyamszintű statisztikák.