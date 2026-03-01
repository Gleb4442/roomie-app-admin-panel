const ServioAdapter = require('./adapters/ServioAdapter');
const EasyMSAdapter = require('./adapters/EasyMSAdapter');

class PMSFactory {
  static PMS_LIST = [
    'Servio',
    'EasyMS'
  ];

  static createAdapter(pms) {
    switch (pms.name) {
      case 'Servio':
        return new ServioAdapter(pms);
      case 'EasyMS':
        return new EasyMSAdapter(pms);
      default:
        throw new Error(`Unsupported PMS type: ${pms.name}`);
    }
  }

  static getAvailablePMS() {
    return this.PMS_LIST;
  }

  static getPMSFields(pmsName) {
    switch (pmsName) {
      case 'Servio':
        return ServioAdapter.GetFields();
      case 'EasyMS':
        return EasyMSAdapter.GetFields();
      default:
        throw new Error(`Unknown PMS type: ${pmsName}`);
    }
  }
}

module.exports = PMSFactory;