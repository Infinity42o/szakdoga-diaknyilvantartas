import {
  Sequelize, Model, DataTypes,
  InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey
} from "sequelize";

export default function makeKurzus(sequelize: Sequelize) {
  class Kurzus extends Model<InferAttributes<Kurzus>, InferCreationAttributes<Kurzus>> {
    declare id: CreationOptional<number>;
    declare tantargy_id: ForeignKey<number>;
    declare tanar_id: ForeignKey<number>;
    declare felev: string;
    declare tipus: "eloadas" | "gyakorlat" | "labor";
    declare kapacitas: number | null;
    declare terem: string | null;
  }

  Kurzus.init({
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    tantargy_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    tanar_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    felev: {
      type: DataTypes.STRING(16),
      allowNull: false
    },
    tipus: {
      type: DataTypes.ENUM("eloadas","gyakorlat","labor"),
      allowNull: false,
      defaultValue: "eloadas"
    },
    kapacitas: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: true,
      defaultValue: 100
    },
    terem: {
      type: DataTypes.STRING(32),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: "kurzus",
    timestamps: false,
    indexes: [
      { name: "ix_kurzus_tantargy", fields: ["tantargy_id"] },
      { name: "ix_kurzus_tanar", fields: ["tanar_id"] }
    ]
  });

  return Kurzus;
}
