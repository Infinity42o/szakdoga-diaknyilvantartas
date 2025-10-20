import { sequelize } from "../config/db";
import makeBeiratkozas from "./beiratkozas";
import makeHallgato from "./hallgato";
import makeKurzus from "./kurzus";
import makeTanar from "./tanar";
import makeTantargy from "./tantargy";

// Létrehozzuk a model instance-okat
const Beiratkozas = makeBeiratkozas(sequelize);
const Hallgato = makeHallgato(sequelize);
const Kurzus = makeKurzus(sequelize);
const Tanar = makeTanar(sequelize);
const Tantargy = makeTantargy(sequelize);

// Asszociációk
Kurzus.belongsTo(Tanar, { foreignKey: "tanar_id", as: "tanar" });
Tanar.hasMany(Kurzus, { foreignKey: "tanar_id", as: "kurzusList" });

Kurzus.belongsTo(Tantargy, { foreignKey: "tantargy_id", as: "tantargy" });
Tantargy.hasMany(Kurzus, { foreignKey: "tantargy_id", as: "kurzusList" });

Beiratkozas.belongsTo(Hallgato, { foreignKey: "hallgato_id", as: "hallgato" });
Hallgato.hasMany(Beiratkozas, { foreignKey: "hallgato_id", as: "beiratkozasList" });

Beiratkozas.belongsTo(Kurzus, { foreignKey: "kurzus_id", as: "kurzus" });
Kurzus.hasMany(Beiratkozas, { foreignKey: "kurzus_id", as: "beiratkozasList" });

export const models = {
  Hallgato,
  Tanar,
  Tantargy,
  Kurzus,
  Beiratkozas,

  // lowercase aliasok, ha valahol úgy hivatkoznál:
  hallgato: Hallgato,
  tanar: Tanar,
  tantargy: Tantargy,
  kurzus: Kurzus,
  beiratkozas: Beiratkozas,
};

export { sequelize };
export async function connect() {
  await sequelize.authenticate();
}
