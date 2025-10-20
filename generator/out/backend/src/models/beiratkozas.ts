import {
  Sequelize, Model, DataTypes,
  InferAttributes, InferCreationAttributes, ForeignKey
} from "sequelize";

export default function makeBeiratkozas(sequelize: Sequelize) {
  class Beiratkozas extends Model<InferAttributes<Beiratkozas>, InferCreationAttributes<Beiratkozas>> {
    declare hallgato_id: ForeignKey<number>;
    declare kurzus_id: ForeignKey<number>;
    declare felvet_datum: Date;
    declare jegy: number | null;
  }

  Beiratkozas.init({
    hallgato_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      allowNull: false
    },
    kurzus_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      allowNull: false
    },
    felvet_datum: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    jegy: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: "beiratkozas",
    timestamps: false,
    indexes: [
      { name: "ix_beiratkozas_kurzus", fields: ["kurzus_id"] }
    ]
  });

  return Beiratkozas;
}
