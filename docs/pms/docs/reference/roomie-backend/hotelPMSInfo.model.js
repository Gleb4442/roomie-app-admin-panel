'use strict';

module.exports = (sequelize, DataTypes) => {
  const HotelPMSInfo = sequelize.define('HotelPMSInfo', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    data: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    hotel_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
  }, {
    tableName: 'HotelPMSInfo',
    underscored: true,
    timestamps: false,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  HotelPMSInfo.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.created_at;
    delete values.updated_at;
    delete values.id;
    delete values.hotel_id;
    return values;
  };

  HotelPMSInfo.associate = (models) => {
    HotelPMSInfo.belongsTo(models.Hotel, { foreignKey: 'hotel_id', as: 'hotel' });
  };

  return HotelPMSInfo;
};
