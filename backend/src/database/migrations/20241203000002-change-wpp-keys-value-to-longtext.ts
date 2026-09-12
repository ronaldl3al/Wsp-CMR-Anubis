import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.changeColumn("WppKeys", "value", {
      type: DataTypes.TEXT("long" as any),
      allowNull: false
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.changeColumn("WppKeys", "value", {
      type: DataTypes.TEXT,
      allowNull: false
    });
  }
};
