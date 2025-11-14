import { sequelize } from "../src/config/db";
import { models } from "../src/models";

export async function seedUndefined(opts: { transaction?: any } = {}) {
  const M = models.Undefined;
  // await M.bulkCreate([{ /* mezők */ }], { transaction: opts.transaction });
}
