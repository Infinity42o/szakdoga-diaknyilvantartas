# SQL mintaadatbázisok és demonstrációs sémák

Ez a dokumentum a projektben használt SQL mintaadatbázisokat foglalja össze. A leírás célja annak bemutatása, hogy a generátor nem egyetlen kézzel kiválasztott sémára készült, hanem több, eltérő szerkezetű MySQL/MariaDB script feldolgozásával is kipróbálható.

A rendszer bemenete minden esetben egy `.sql` fájl. A generátor a `CREATE TABLE`, `ALTER TABLE` és `INSERT INTO` utasításokból állítja elő a `schema.json` köztes leírást, majd ebből generálja a backend modelleket, route-okat, metaadatokat és statisztikai végpontokat.

## 1. A mintaadatbázisok szerepe

A projektben négy fontos SQL példa szerepel:

| SQL fájl | Adatbázisnév | Szerep |
|---|---|---|
| `db/diaknyilvantartas.sql` | `diaknyilvantartas` | Fő demonstrációs adatbázis, többtáblás oktatási nyilvántartás nézetekkel és összetett kulccsal. |
| `db/01_ugyfel_crud.sql` | `teszt_ugyfel_crud3` | Egyszerű, egytáblás CRUD tesztadatbázis. |
| `db/teszt-webshop.sql` | `teszt_webshop` | Többtáblás webshop példa idegen kulcsokkal és rendeléstételekkel. |
| `db/teszt_halado.sql` | `teszt_kurzus_halado` | Haladó oktatási példa `ALTER TABLE` utasításokkal, enumokkal és összetett elsődleges kulccsal. |

Ezek együtt lefedik a dolgozat szempontjából lényeges eseteket: egyszerű CRUD, idegen kulcsok, egyedi kulcsok, indexek, enumerációs mezők, automatikusan növekvő azonosítók, összetett elsődleges kulcsok, valamint kezdeti adatok betöltése.

## 2. Fő demonstrációs adatbázis: `diaknyilvantartas.sql`

A `diaknyilvantartas.sql` egy egyetemi jellegű nyilvántartást ír le. Ez a projekt fő bemutató adatbázisa, mert több egymáshoz kapcsolódó táblát, összetett kulcsot, idegen kulcsokat, indexeket, egyedi megszorításokat, enum mezőket és nézeteket is tartalmaz.

### 2.1 Fogalmi modell

A séma fő entitásai:

| Tábla | Szerep |
|---|---|
| `hallgato` | Hallgatók adatai, például név, Neptun-kód, szak, évfolyam, e-mail. |
| `tanar` | Oktatók adatai, például név, tanszék és e-mail. |
| `tantargy` | Tantárgytörzs, tárgykóddal, névvel, kredittel és aktív jelzővel. |
| `kurzus` | Konkrét kurzusok, amelyek egy tantárgyhoz és egy oktatóhoz kapcsolódnak. |
| `beiratkozas` | Kapcsolótábla hallgatók és kurzusok között. |

Kapcsolatok:

```text
hallgato (1) ── (N) beiratkozas (N) ── (1) kurzus
kurzus  (N) ── (1) tantargy
kurzus  (N) ── (1) tanar
```

### 2.2 Táblák és fontosabb mezők

#### `hallgato`

A hallgatók törzsadatait tárolja.

Fontosabb mezők:

- `id`: elsődleges kulcs, automatikusan növekvő azonosító,
- `neptun`: egyedi Neptun-kód,
- `nev`: hallgató neve,
- `nem`: enum mező,
- `szak`: szak neve,
- `evfolyam`: évfolyam,
- `szuldatum`: születési dátum,
- `email`: opcionális, de egyedi e-mail cím.

A tábla jól használható az automatikus űrlapgenerálás és az `AUTO_INCREMENT` kezelés demonstrálására.

#### `tanar`

Az oktatók adatait tartalmazza.

Fontosabb mezők:

- `id`: elsődleges kulcs,
- `nev`: oktató neve,
- `tanszek`: tanszék,
- `email`: kötelező és egyedi e-mail cím.

A tábla a kapcsolatok szempontjából azért fontos, mert a `kurzus` tábla idegen kulccsal hivatkozik rá.

#### `tantargy`

A tantárgyak törzsadatait írja le.

Fontosabb mezők:

- `id`: elsődleges kulcs,
- `kod`: egyedi tantárgykód,
- `nev`: tantárgy neve,
- `kredit`: kreditérték,
- `aktiv`: logikai jellegű mező.

Ez a tábla a statisztikai nézetekhez is hasznos, mert numerikus mezőt tartalmaz.

#### `kurzus`

A konkrét kurzusokat tárolja.

Fontosabb mezők:

- `id`: elsődleges kulcs,
- `tantargy_id`: idegen kulcs a `tantargy` táblára,
- `tanar_id`: idegen kulcs a `tanar` táblára,
- `felev`: félév,
- `tipus`: enum mező, például előadás, gyakorlat vagy labor,
- `kapacitas`: numerikus mező,
- `terem`: opcionális szöveges mező.

A `kurzus` tábla fontos teszteset, mert több idegen kulccsal rendelkezik. A frontend ezért nem puszta azonosítókat jelenít meg, hanem felhasználóbarát címkéket próbál előállítani.

#### `beiratkozas`

Kapcsolótábla a hallgatók és kurzusok között.

Fontosabb mezők:

- `hallgato_id`: idegen kulcs a `hallgato` táblára,
- `kurzus_id`: idegen kulcs a `kurzus` táblára,
- `felvet_datum`: beiratkozás dátuma,
- `jegy`: opcionális jegy.

A tábla összetett elsődleges kulcsa:

```text
(hallgato_id, kurzus_id)
```

Ez a generátor egyik fontos tesztesete, mert a CRUD végpontoknak nem elég egyetlen `:id` paramétert használniuk. Módosításnál és törlésnél mindkét kulcsmező szükséges.

### 2.3 Nézetek kezelése

A `diaknyilvantartas.sql` nézeteket is tartalmaz, például hallgatói kreditösszegzést és tantárgyi átlagot. A generátor ezeket nem vonja be CRUD entitásként, mert a feladat szempontjából a rekordkezelés elsődlegesen az alaptáblákra vonatkozik.

Ez fontos tervezési döntés: a nézetek hasznosak lekérdezésre és demonstrációra, de automatikus beszúrás, módosítás és törlés szempontjából nem kezelhetők ugyanúgy, mint az alaptáblák.

### 2.4 A fő adatbázis tesztelési szerepe

A `diaknyilvantartas` séma a következő funkciók ellenőrzésére alkalmas:

- több összekapcsolt tábla felismerése,
- elsődleges kulcsok és összetett elsődleges kulcs kezelése,
- idegen kulcsok felismerése,
- enum mezők kezelése,
- `AUTO_INCREMENT` mezők felismerése,
- nézetek kiszűrése,
- rekordok listázása, beszúrása, módosítása és törlése,
- statisztikai csoportosítások és diagramok kipróbálása.

## 3. Egyszerű CRUD példa: `01_ugyfel_crud.sql`

A `01_ugyfel_crud.sql` egy egyszerű, egytáblás ügyfél-nyilvántartó adatbázist hoz létre. Ez a példa a generátor alapműködésének gyors ellenőrzésére készült.

### 3.1 Szerkezet

Az adatbázis egyetlen táblát tartalmaz:

| Tábla | Szerep |
|---|---|
| `ugyfel` | Ügyféladatok tárolása. |

Fontosabb mezők:

- `id`: elsődleges kulcs, `AUTO_INCREMENT`,
- `nev`: ügyfél neve,
- `email`: kötelező és egyedi e-mail cím,
- `telefon`: opcionális telefonszám,
- `varos`: város,
- `eletkor`: opcionális numerikus mező,
- `regisztracio_datuma`: dátummező,
- `aktiv`: logikai jellegű mező.

### 3.2 Tesztelési cél

Ez az adatbázis az alábbi funkciók ellenőrzésére alkalmas:

- egyetlen tábla feldolgozása,
- egyszerű CRUD műveletek,
- `AUTO_INCREMENT` mező elrejtése új rekord felvételekor,
- egyedi kulcs kezelése az `email` mezőn,
- indexelt mező kezelése a `varos` oszlopon,
- dátummező és logikai jellegű mező megjelenítése,
- egyszerű statisztikák, például ügyfelek száma város szerint.

Ez a példa azért hasznos, mert ha ezen a sémán hibátlanul működik a generátor, akkor az alapvető CRUD lánc megfelelően van összerakva.

## 4. Webshop példa: `teszt-webshop.sql`

A `teszt-webshop.sql` egy többtáblás webshop adatbázist ír le. Ez már összetettebb, mint az ügyfélpélda, mert több entitást, több idegen kulcsot és rendelési kapcsolatokat is tartalmaz.

### 4.1 Fogalmi modell

Fő táblák:

| Tábla | Szerep |
|---|---|
| `kategoria` | Termékkategóriák. |
| `termek` | Termékek, kategóriához kapcsolva. |
| `rendeles` | Vevői rendelések. |
| `rendeles_tetel` | Rendelések tételei, termékekkel összekapcsolva. |

Kapcsolatok:

```text
kategoria (1) ── (N) termek
rendeles  (1) ── (N) rendeles_tetel
termek    (1) ── (N) rendeles_tetel
```

### 4.2 Fontosabb sémaelemek

A `kategoria` tábla egyedi kategórianévvel rendelkezik. A `termek` tábla idegen kulccsal hivatkozik a kategóriára, továbbá tartalmaz numerikus mezőket, például árat és készletet.

A `rendeles` tábla az ügyfél nevét, a rendelés dátumát és az állapotot tárolja. Az `allapot` enum mező, amely jól demonstrálja a lenyíló listás megjelenítést.

A `rendeles_tetel` tábla a rendeléseket és termékeket kapcsolja össze. Itt több idegen kulcs is szerepel:

- `rendeles_id` → `rendeles(id)`,
- `termek_id` → `termek(id)`.

### 4.3 Tesztelési cél

A webshop példa a következő eseteket teszteli:

- több táblából álló adatbázis feldolgozása,
- több idegen kulcs kezelése,
- egy-a-többhöz kapcsolatok megjelenítése,
- enum mező kezelése rendelési állapothoz,
- numerikus mezők használata statisztikákhoz,
- rendeléstételek CRUD kezelése,
- idegen kulcsos választómezők felhasználóbarát megjelenítése.

A statisztikai nézetben például vizsgálható termékek száma kategóriánként, készletösszesítés kategória szerint, vagy rendeléstételek száma rendelésenként.

## 5. Haladó oktatási példa: `teszt_halado.sql`

A `teszt_halado.sql` egy kisebb, de szerkezetileg kifejezetten hasznos oktatási nyilvántartó séma. Ez a példa azért fontos, mert több kulcsot és kapcsolatot nem közvetlenül a `CREATE TABLE` blokkokban, hanem utólagos `ALTER TABLE` utasításokkal ad meg.

### 5.1 Fogalmi modell

Fő táblák:

| Tábla | Szerep |
|---|---|
| `hallgato` | Hallgatók adatai. |
| `oktato` | Oktatók adatai. |
| `kurzus` | Oktatóhoz kapcsolódó kurzusok. |
| `jelentkezes` | Hallgatók kurzusjelentkezései. |

Kapcsolatok:

```text
oktato   (1) ── (N) kurzus
hallgato (1) ── (N) jelentkezes (N) ── (1) kurzus
```

### 5.2 Fontosabb sémaelemek

A `hallgato` tábla tartalmaz egyedi e-mail címet, de az egyedi kulcs nem a `CREATE TABLE` blokkban, hanem külön `ALTER TABLE` utasítással kerül hozzáadásra.

Az `oktato` tábla enum mezőt használ a beosztás tárolására:

```text
'tanarseged', 'adjunktus', 'docens', 'professzor'
```

A `kurzus` tábla oktatóhoz kapcsolódik, és szintén tartalmaz enum mezőt a kurzus típusához.

A `jelentkezes` tábla összetett elsődleges kulcsot használ:

```text
(hallgato_id, kurzus_id)
```

Ez azt jelenti, hogy ugyanaz a hallgató ugyanarra a kurzusra csak egyszer jelentkezhet. Ez a tábla a kompozit kulcsos CRUD műveletek fontos tesztesete.

### 5.3 Tesztelési cél

A haladó példa az alábbi funkciókat ellenőrzi:

- `ALTER TABLE` alapú kulcsok és indexek feldolgozása,
- utólag hozzáadott egyedi kulcsok felismerése,
- utólag hozzáadott idegen kulcsok felismerése,
- összetett elsődleges kulcs kezelése,
- enum mezők kezelése,
- több kapcsolt tábla együttes megjelenítése,
- statisztikák készítése például szak, kurzustípus vagy jelentkezési állapot szerint.

Ez a séma különösen alkalmas annak igazolására, hogy a parser nem csak az egyszerű `CREATE TABLE` definíciókat tudja kezelni, hanem a gyakorlatban gyakori, utólagos `ALTER TABLE` alapú szerkezeteket is.

## 6. A mintaadatbázisok összehasonlítása

| Funkció / sémaelem | `ugyfel` | `webshop` | `kurzus_halado` | `diaknyilvantartas` |
|---|---:|---:|---:|---:|
| Több tábla | nem | igen | igen | igen |
| `AUTO_INCREMENT` | igen | igen | igen | igen |
| Egyedi kulcs | igen | igen | igen | igen |
| Index | igen | igen | igen | igen |
| Idegen kulcs | nem | igen | igen | igen |
| Enum mező | nem | igen | igen | igen |
| Összetett elsődleges kulcs | nem | nem | igen | igen |
| `ALTER TABLE` alapú kapcsolat | nem | nem | igen | igen |
| Kezdeti adatok | igen | igen | igen | igen |
| Statisztikai tesztre alkalmas | igen | igen | igen | igen |

A táblázat alapján látható, hogy a tesztadatbázisok fokozatosan növelik a séma bonyolultságát. Az egyszerű ügyféltábla az alap CRUD működést, a webshop séma a kapcsolatok kezelését, a haladó kurzusos példa az `ALTER TABLE` és az összetett kulcsok kezelését, a `diaknyilvantartas` pedig a teljesebb demonstrációt szolgálja.

## 7. Használat másik adatbázissal

Másik SQL fájl kipróbálásakor mindig ugyanazt a folyamatot kell követni:

1. az SQL fájlt importálni kell MariaDB/MySQL alá,
2. a `generator/.env` fájlban át kell írni a `DB_NAME` értékét,
3. újra kell futtatni a parser lépést,
4. újra kell generálni a backendet,
5. újra kell indítani a Node.js backendet,
6. a frontend oldalt frissíteni kell.

Példa:

```powershell
cd C:\projektek\szakdoga\generator
npm run parse:dump -- ..\db\teszt-webshop.sql .\out
npm run gen:backend
npm run start:backend
```

A frontend normál esetben nem igényel táblaspecifikus módosítást, mert a táblák és mezők leírását a `/api/meta` végpontból kapja meg.

## 8. Következtetés

A négy mintaadatbázis együtt jól mutatja a generátor működési tartományát. A rendszer nem a teljes MySQL nyelv minden lehetséges elemét próbálja lefedni, hanem a feladat szempontjából lényeges és gyakori szerkezeteket kezeli: táblák, oszlopok, kulcsok, idegen kulcsok, indexek, enumok, automatikusan növekvő azonosítók és kezdeti adatok.

A példák alapján a generátor alkalmas arra, hogy különböző felépítésű MySQL/MariaDB scriptekből működő CRUD és statisztikai felületet biztosító alkalmazást állítson elő. A tesztadatbázisok ezért nemcsak fejlesztési segédeszközök, hanem a szakdolgozati demonstráció fontos bizonyítékai is.
