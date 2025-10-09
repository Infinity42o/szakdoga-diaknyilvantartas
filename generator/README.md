# Generator

---

## 3) `generator/README.md` — részletes futtatás + architektúra + minta
```powershell
Set-Content .\generator\README.md @'
# Generator – SQL → JSON (+ Handlebars demo)

## Cél
A `db/diaknyilvantartas.sql` alapján közbenső sémát (`out/schema.json`) állít elő, és egy próbakimenetet generál (`out/samples/HELLO.txt`).

## Futtatás
```bash
cd generator
npm install   # első futtatásnál
npm run generate -- --input ../db/diaknyilvantartas.sql --out ./out
