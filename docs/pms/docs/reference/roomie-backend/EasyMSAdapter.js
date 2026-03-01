class EasyMSAdapter {
  constructor(pms) {
    if (!pms) throw new Error('PMS info is required');
    this.pms = pms;
    this.baseURL = pms.api_url || 'https://my.easyms.co';
    
    const username = process.env.EASYMS_USERNAME;
    const password = process.env.EASYMS_PASSWORD;
    
    if (!username || !password) {
      throw new Error('Environment variables EASYMS_USERNAME and EASYMS_PASSWORD are not set');
    }
    
    this.username = username;
    this.password = password;
    this.accessToken = null;
  }

  async _authenticate() {
    if (this.accessToken) return;
    
    const response = await fetch(`${this.baseURL}/api/integration/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.username,
        password: this.password
      })
    });

    const result = await response.json();
    
    if (!response.ok || result.error) {
      throw new Error(`EasyMS authentication failed: ${result.error?.message || response.statusText}`);
    }

    this.accessToken = result.data.access_token;
  }

  async _makeRequest(endpoint, options = {}) {
    await this._authenticate();
    
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
        ...options.headers
      }
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error(`❌ EasyMS API error: ${response.status} ${response.statusText}`);
      console.error(result);
      throw new Error(`EasyMS request failed: ${result.error?.message || response.statusText}`);
    }

    if (result.error) {
      throw new Error(`EasyMS error: ${result.error.message}`);
    }

    console.log(JSON.stringify(result));

    return result.data;
  }

  static GetFields() {
    return {
      fields: [
        { key: "organizationId", label: "Organization ID", type: "number", required: true },
        { key: "defaultRateId", label: "Default Rate ID", type: "number", required: true }
      ]
    };
  }

  async getRoomTypes() {
    const organizationId = this.pms.data.organizationId;
    
    const categories = await this._makeRequest(
      `/api/integration/categories?organizationId=${organizationId}`
    );

    const roomTypes = {};
    for (const category of categories) {
      roomTypes[category.name] = category.id;
    }

    return roomTypes;
  }

  async getAvailability(params) {
    const organizationId = this.pms.data.organizationId;
    const dateFrom = params.DateArrival.split('T')[0];
    const dateTo = params.DateDeparture.split('T')[0];

    const queryParams = new URLSearchParams({
      organizationId: organizationId,
      dateFrom: dateFrom,
      dateTo: dateTo
    });

    try {
      const availability = await this._makeRequest(
        `/api/integration/availability?${queryParams}`
      );

      const grouped = {};
      
      if (Array.isArray(availability)) {
        availability.forEach(item => {
          if (!grouped[item.categoryId]) {
            grouped[item.categoryId] = {
              id: item.categoryId,
              freeRooms: 999,
              dailyAvailability: []
            };
          }
          
          if (item.dailyOccupancies && Array.isArray(item.dailyOccupancies)) {
            item.dailyOccupancies.forEach(day => {
              const date = new Date(day.date).toISOString().split('T')[0];
              
              grouped[item.categoryId].dailyAvailability.push({
                date: date,
                available: day.available || 0,
                occupancy: day.occupancy || 0
              });
              
              if (day.available !== undefined && day.available < grouped[item.categoryId].freeRooms) {
                grouped[item.categoryId].freeRooms = day.available;
              }
            });
          }
        });
      }

      return {
        success: true,
        error: null,
        errorCode: null,
        roomTypes: Object.values(grouped)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'AVAILABILITY_ERROR',
        roomTypes: []
      };
    }
  }

  async getPrices(params) {
    const organizationId = this.pms.data.organizationId;
    const rateId = this.pms.data.defaultRateId;
    
    const dateFrom = params.DateArrival.split('T')[0];
    const dateTo = params.DateDeparture.split('T')[0];

    const queryParams = new URLSearchParams({
      categories: [params.RoomTypeID],
      organizationId: organizationId,
      dateFrom: dateFrom,
      dateTo: dateTo,
      rateId: rateId,
      detailed: 'true'
    });

    try {
      const response = await this._makeRequest(
        `/api/integration/prices?${queryParams}`
      );

      const prices = response.prices || [];

      if (!Array.isArray(prices) || prices.length === 0) {
        return [{
          success: false,
          error: 'Ціни не знайдено',
          errorCode: 'NO_PRICES',
          prices: [],
          totalSum: 0,
          currency: 'UAH'
        }];
      }

      const pricesByDate = prices
        .filter(p => p.categoryId === params.RoomTypeID)
        .map(priceInfo => ({
          date: priceInfo.date || dateFrom,
          basePrice: priceInfo.value || 0,
          taxes: 0,
          total: priceInfo.value || 0
        }));

      if (pricesByDate.length === 0) {
        return [{
          success: false,
          error: 'Ціни не знайдено для цього типу номера',
          errorCode: 'NO_PRICES_FOR_ROOM_TYPE',
          prices: [],
          totalSum: 0,
          currency: 'UAH'
        }];
      }

      const totalSum = pricesByDate.reduce((sum, p) => sum + p.total, 0);

      return [{
        success: true,
        error: null,
        errorCode: null,
        prices: pricesByDate,
        totalSum: totalSum,
        currency: 'UAH'
      }];
    } catch (error) {
      return [{
        success: false,
        error: error.message,
        errorCode: 'PRICE_ERROR',
        prices: [],
        totalSum: 0,
        currency: 'UAH'
      }];
    }
  }

  async addRoomReservation(data) {
    const organizationId = this.pms.data.organizationId;
    const rateId = this.pms.data.defaultRateId;

    const pricesData = await this.getPrices({
      DateArrival: data.DateArrival,
      DateDeparture: data.DateDeparture,
      Adults: data.Adults || 1,
      Children: data.Children || 0,
      RoomTypeID: data.RoomTypeID
    });

    const invoice = pricesData[0]?.totalSum || 0;

    const orderData = {
      organizationId: organizationId,
      customer: {
        name: `${data.ContactName || ''} ${data.GuestLastName || ''}`.trim(),
        telephone: data.Phone || '',
        email: data.Email || '',
        remarks: data.Comment || ''
      },
      rooms: [{
        arrival: data.DateArrival.split('T')[0],
        departure: data.DateDeparture.split('T')[0],
        categoryId: data.RoomTypeID,
        rateId: rateId,
        invoice: invoice
      }]
    };

    try {
      const result = await this._makeRequest('/api/integration/orders', {
        method: 'POST',
        body: JSON.stringify(orderData)
      });

      return {
        success: true,
        error: null,
        errorCode: null,
        reservationId: result.orderId,
        message: 'Бронювання успішно створено'
      };
    } catch (error) {
      console.error('❌ EasyMS reservation error:', error);
      return {
        success: false,
        error: error.message,
        errorCode: 'RESERVATION_ERROR',
        reservationId: null,
        message: error.message
      };
    }
  }
}

module.exports = EasyMSAdapter;