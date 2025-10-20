import {
  Sequelize, Model, DataTypes,
  InferAttributes, InferCreationAttributes, CreationOptional
} from "sequelize";

export default function makeTanar(sequelize: Sequelize) {
  class Tanar extends Model<InferAttributes<Tanar>, InferCreationAttributes<Tanar>> {
    declare id: CreationOptional<number>;
    declare nev: string;
    declare tanszek: string;
    declare email: string;
  }

  Tanar.init({
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    nev: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    tanszek: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: "uq_tanar_email"
    }
  }, {
    sequelize,
    tableName: "tanar",
    timestamps: false
  });

  return Tanar;
}
