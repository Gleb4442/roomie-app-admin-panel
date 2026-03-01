'use strict';

module.exports = (sequelize, DataTypes) => {
  const Hotel = sequelize.define(
    'Hotel',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      prompt: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      location_lat: DataTypes.FLOAT,
      location_lng: DataTypes.FLOAT,
      show_telegram_button: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      show_powered_by: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      theme: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      accent_color: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      image_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      button_shape: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'elipse',
      },
      button_icon: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'square_message',
      },
      button_side: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'left',
      },
      button_offset_x: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      button_offset_y: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      button_size: {
        type: DataTypes.DOUBLE,
        allowNull: false,
        defaultValue: 1,
      },
      button_animation: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'Hotels',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  Hotel.prototype.toJSON = function () {
    const values = { ...this.get() };
    values.pms = values.pmsInfo || null;
    delete values.pmsInfo;
    return values;
  };

  Hotel.associate = (models) => {
    Hotel.hasMany(models.Room, {
      foreignKey: 'hotel_id',
      as: 'rooms',
    });
    Hotel.hasMany(models.Message, { foreignKey: 'hotel_id', as: 'hotelMessages' });
    Hotel.hasOne(models.HotelPMSInfo, { foreignKey: 'hotel_id', as: 'pmsInfo' });
    Hotel.hasMany(models.Reservation, { foreignKey: 'hotel_id', as: 'reservations' });
    Hotel.belongsToMany(models.Manager, {
      through: 'ManagerHotels',
      foreignKey: 'hotelId',
      otherKey: 'managerId',
      as: 'managers',
    });
  };

  return Hotel;
};
