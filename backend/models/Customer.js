'use strict';

module.exports = (sequelize, DataTypes) => {
  const Customer = sequelize.define('Customer', {
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'tenant_id'
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    legacyCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'legacy_code'
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    address2: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'address_2'
    },
    phone: {
      type: DataTypes.STRING(25),
      allowNull: true
    },
    phone2: {
      type: DataTypes.STRING(25),
      allowNull: true,
      field: 'phone_2'
    },
    regionCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'region_code'
    },
    regionName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'region_name'
    },
    typeCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'type_code'
    },
    typeName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'type_name'
    },
    areaCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'area_code'
    },
    areaName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'area_name'
    },
    districtName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'district_name'
    },
    salespersonCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'salesperson_code'
    },
    salespersonName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'salesperson_name'
    },
    salespersonId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'salesperson_id'
    },
    topDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'top_days'
    },
    creditLimit: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'credit_limit'
    },
    contactPerson: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'contact_person'
    },
    contactPersonPhone: {
      type: DataTypes.STRING(25),
      allowNull: true,
      field: 'contact_person_phone'
    },
    nik: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    npwp: {
      type: DataTypes.STRING(35),
      allowNull: true
    },
    taxName: {
      type: DataTypes.STRING(150),
      allowNull: true,
      field: 'tax_name'
    },
    taxAddress1: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'tax_address_1'
    },
    taxAddress2: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'tax_address_2'
    },
    taxBlock: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'tax_block'
    },
    taxHouseNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'tax_house_number'
    },
    taxRt: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: 'tax_rt'
    },
    taxRw: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: 'tax_rw'
    },
    taxKelurahan: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'tax_kelurahan'
    },
    taxKecamatan: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'tax_kecamatan'
    },
    taxCity: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'tax_city'
    },
    taxProvince: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'tax_province'
    },
    priceTier: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'price_tier'
    },
    visitDays: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'visit_days',
      get() {
        const rawValue = this.getDataValue('visitDays');
        if (!rawValue) return [];
        if (Array.isArray(rawValue)) return rawValue;
        try { return JSON.parse(rawValue); } catch (e) { return rawValue.split(',').map(s => s.trim()).filter(Boolean); }
      },
      set(value) {
        if (!value) {
          this.setDataValue('visitDays', null);
        } else if (Array.isArray(value)) {
          this.setDataValue('visitDays', JSON.stringify(value));
        } else {
          this.setDataValue('visitDays', value);
        }
      }
    },
    visitWeeks: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'visit_weeks',
      get() {
        const rawValue = this.getDataValue('visitWeeks');
        if (!rawValue) return [];
        if (Array.isArray(rawValue)) return rawValue;
        try { return JSON.parse(rawValue); } catch (e) { return rawValue.split(',').map(s => s.trim()).filter(Boolean); }
      },
      set(value) {
        if (!value) {
          this.setDataValue('visitWeeks', null);
        } else if (Array.isArray(value)) {
          this.setDataValue('visitWeeks', JSON.stringify(value));
        } else {
          this.setDataValue('visitWeeks', value);
        }
      }
    },
    visitTime: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: 'visit_time'
    },
    openOutletDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'open_outlet_date'
    },
    metadata: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('metadata');
        if (!rawValue) return null;
        if (typeof rawValue === 'object') return rawValue;
        try { return JSON.parse(rawValue); } catch (e) { return rawValue; }
      },
      set(value) {
        if (value === null || value === undefined) {
          this.setDataValue('metadata', null);
        } else if (typeof value === 'object') {
          this.setDataValue('metadata', JSON.stringify(value));
        } else {
          this.setDataValue('metadata', value);
        }
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active'
    }
  }, {
    tableName: 'customers',
    underscored: true,
    timestamps: true
  });

  Customer.associate = (models) => {
    Customer.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    if (models.Salesperson) {
      Customer.belongsTo(models.Salesperson, { foreignKey: 'salespersonId', as: 'salesperson' });
    }
    if (models.SalesOrder) {
      Customer.hasMany(models.SalesOrder, { foreignKey: 'contactId', as: 'salesOrders' });
    }
  };

  return Customer;
};
