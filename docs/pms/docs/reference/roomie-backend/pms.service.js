const { Hotel, HotelPMSInfo, Reservation } = require('../../models');
const PMSFactory = require('../pms/PMSFactory');

async function getRoomTypes(hotel_id) {
  const hotel = await Hotel.findByPk(hotel_id, {
    include: [{ model: HotelPMSInfo, as: 'pmsInfo' }]
  });

  if (!hotel || !hotel.pmsInfo) {
    throw new Error('Hotel or PMS info not found');
  }

  const adapter = PMSFactory.createAdapter(hotel.pmsInfo);
  return adapter.getRoomTypes();
}

async function getPrices(data) {
  const hotel = await Hotel.findByPk(data.hotel_id, {
    include: [{ model: HotelPMSInfo, as: 'pmsInfo' }]
  });

  if (!hotel || !hotel.pmsInfo) {
    throw new Error('Hotel or PMS info not found');
  }

  const adapter = PMSFactory.createAdapter(hotel.pmsInfo);
  
  const response = await adapter.getPrices({
    DateArrival: data.DateArrival,
    DateDeparture: data.DateDeparture,
    Adults: data.Adults ?? 1,
    Children: data.Children ?? 0,
    RoomTypeID: data.RoomTypeID,
    IsExtraBedUsed: data.IsExtraBedUsed || false
  });

  return response;
}

async function getAvailability(data) {
  const hotel = await Hotel.findByPk(data.hotel_id, {
    include: [{ model: HotelPMSInfo, as: 'pmsInfo' }]
  });

  if (!hotel || !hotel.pmsInfo) {
    throw new Error('Hotel or PMS info not found');
  }

  const adapter = PMSFactory.createAdapter(hotel.pmsInfo);
  
  const response = await adapter.getAvailability({
    DateArrival: data.DateArrival,
    DateDeparture: data.DateDeparture,
    Adults: data.Adults ?? 1,
    Children: data.Children ?? 0,
    IsExtraBedUsed: data.IsExtraBedUsed ?? false,
    lang: data.lang || 'uk'
  });

  return response;
}

async function addReservation(data, chatId) {
  if (!chatId) {
    throw new Error('Chat ID is required');
  }

  const allowedFields = [
    'DateArrival', 'DateDeparture', 'RoomTypeID', 'Adults',
    'ContactName', 'GuestLastName', 'Phone',
    'Email', 'Children', 'Comment', 'ChildAges', 'IsExtraBedUsed'
  ];

  const reservationData = {};
  for (const key of allowedFields) {
    if (data[key] !== undefined) reservationData[key] = data[key];
  }

  const requiredFields = [
    'DateArrival', 'DateDeparture', 'RoomTypeID',
    'Adults', 'ContactName', 'GuestLastName', 'Phone'
  ];

  for (const field of requiredFields) {
    if (!reservationData[field]) {
      throw new Error(`Missing field: ${field}`);
    }
  }

  const hotel = await Hotel.findByPk(data.hotel_id, {
    include: [{ model: HotelPMSInfo, as: 'pmsInfo' }]
  });

  if (!hotel || !hotel.pmsInfo) {
    throw new Error('Hotel or PMS info not found');
  }

  const adapter = PMSFactory.createAdapter(hotel.pmsInfo);
  
  const result = await adapter.addRoomReservation(reservationData);

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      errorCode: result.errorCode,
      message: result.message
    };
  }

  const pricesData = await adapter.getPrices({
    DateArrival: reservationData.DateArrival,
    DateDeparture: reservationData.DateDeparture,
    Adults: reservationData.Adults,
    Children: reservationData.Children || 0,
    RoomTypeID: reservationData.RoomTypeID,
    IsExtraBedUsed: reservationData.IsExtraBedUsed || false
  });

  const totalPrice = pricesData[0]?.totalSum || 0;

  await Reservation.create({
    hotel_id: data.hotel_id,
    date_arrival: reservationData.DateArrival,
    date_departure: reservationData.DateDeparture,
    room_type_id: reservationData.RoomTypeID,
    adults: reservationData.Adults,
    children: reservationData.Children || 0,
    contact_name: reservationData.ContactName,
    guest_last_name: reservationData.GuestLastName,
    phone: reservationData.Phone,
    email: reservationData.Email || '',
    comment: reservationData.Comment || '',
    price: totalPrice,
    chat_id: chatId,
    pms_name: hotel.pmsInfo.name,
    reservation_id: result.reservationId
  });

  return {
    success: true,
    error: null,
    errorCode: null,
    reservationId: result.reservationId,
    price: totalPrice,
    message: result.message
  };
}

module.exports = {
  getRoomTypes,
  getPrices,
  getAvailability,
  addReservation
};