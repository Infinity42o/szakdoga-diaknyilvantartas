import {
  Sequelize, Model, DataTypes,
  InferAttributes, InferCreationAttributes, CreationOptional
} from "sequelize";

export default function makeTantargy(sequelize: Sequelize) {
  class Tantargy extends Model<InferAttributes<Tantargy>, InferCreationAttributes<Tantargy>> {
    declare id: CreationOptional<number>;
    declare kod: string;
    declare nev: string;
    declare kredit: number;
    declare aktiv: number; // TINYINT(1)
  }

  Tantargy.init({
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    kod: {
      type: DataTypes.STRING(16),
      allowNull: false,
      unique: "uq_tantargy_kod"
    },
    nev: {
      type: DataTypes.STRING(160),
      allowNull: false
    },
    kredit: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false
    },
    aktiv: {
      type: DataTypes.TINYINT, // nem BOOLEAN, mert a dump TINYINT(1)
      allowNull: false,
      defaultValue: 1
    }
  }, {
    sequelize,
    tableName: "tantargy",
    timestamps: false
  });

  return Tantargy;
}
