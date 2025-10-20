import {
  Sequelize, Model, DataTypes,
  InferAttributes, InferCreationAttributes, CreationOptional
} from "sequelize";

export default function makeHallgato(sequelize: Sequelize) {
  class Hallgato extends Model<InferAttributes<Hallgato>, InferCreationAttributes<Hallgato>> {
    declare id: CreationOptional<number>;
    declare neptun: string;
    declare nev: string;
    declare nem: "no" | "ferfi" | "egyeb" | null;
    declare szak: string;
    declare evfolyam: number;
    declare szuldatum: string | null; // DATEONLY
    declare email: string | null;
  }

  Hallgato.init({
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    neptun: {
      type: DataTypes.CHAR(6),
      allowNull: false,
      unique: true
    },
    nev: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    nem: {
      type: DataTypes.ENUM("no","ferfi","egyeb"),
      allowNull: true
    },
    szak: {
      type: DataTypes.STRING(80),
      allowNull: false
    },
    evfolyam: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false
    },
    szuldatum: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    email: {
      type: DataTypes.STRING(120),
      allowNull: true,
      unique: "uq_hallgato_email"
    }
  }, {
    sequelize,
    tableName: "hallgato",
    timestamps: false
  });

  return Hallgato;
}
