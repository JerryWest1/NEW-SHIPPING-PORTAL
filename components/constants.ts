
import { ShipmentStatus, Address, Shipment } from '../types';

// In a real app, these would be N8N Webhook URLs
export const N8N_WEBHOOKS = {
  CREATE_LABEL: 'https://n8n.yourdomain.com/webhook/create-label',
  GET_TRACKING: 'https://n8n.yourdomain.com/webhook/get-tracking',
  UPDATE_STATUS: 'https://n8n.yourdomain.com/webhook/update-status',
};

export const MOCK_SENDERS: Address[] = [
  {
    id: 's1',
    name: 'Warehouse A',
    company: 'My Logistics Co',
    street1: '123 Industrial Pkwy',
    city: 'Memphis',
    state: 'TN',
    zip: '38116',
    country: 'US',
    phone: '555-0101',
    email: 'shipping@mylogistics.com',
    type: 'SENDER'
  },
  {
    id: 's2',
    name: 'HQ Office',
    company: 'My Logistics Co',
    street1: '456 Corporate Blvd',
    city: 'New York',
    state: 'NY',
    zip: '10001',
    country: 'US',
    phone: '555-0102',
    email: 'admin@mylogistics.com',
    type: 'SENDER'
  }
];

export const MOCK_RECIPIENTS: Address[] = [
  {
    id: 'r1',
    name: 'John Doe',
    company: 'Acme Corp',
    street1: '789 Business Rd',
    city: 'Austin',
    state: 'TX',
    zip: '73301',
    country: 'US',
    phone: '555-0201',
    email: 'john.doe@acme.com',
    type: 'RECIPIENT'
  },
  {
    id: 'r2',
    name: 'Jane Smith',
    street1: '101 Residential Ln',
    city: 'Seattle',
    state: 'WA',
    zip: '98101',
    country: 'US',
    phone: '555-0202',
    email: 'jane.smith@gmail.com',
    type: 'RECIPIENT'
  }
];

export const INTERNAL_USERS = [
  { value: 'Nachman', label: 'Nachman' },
  { value: 'Gitty', label: 'Gitty' },
  { value: 'Tzipora', label: 'Tzipora' },
  { value: 'Robert', label: 'Robert' },
  { value: 'Jerry', label: 'Jerry' },
  { value: 'Danny', label: 'Danny' },
  { value: 'Jacob', label: 'Jacob' },
  { value: 'Manny', label: 'Manny' },
  { value: 'Abie', label: 'Abie' },
  { value: 'Joe', label: 'Joe' },
  { value: 'Andrew', label: 'Andrew' },
];

export const SERVICE_TYPES = [
  { value: 'fedex_priority_overnight', label: 'FedEx Priority Overnight' },
  { value: 'fedex_standard_overnight', label: 'FedEx Standard Overnight' },
  { value: 'fedex_first_overnight', label: 'FedEx First Overnight' },
  { value: 'fedex_2_day', label: 'FedEx 2Day' },
  { value: 'fedex_2_day_am', label: 'FedEx 2Day A.M.' },
  { value: 'fedex_express_saver', label: 'FedEx Express Saver' },
  { value: 'fedex_ground', label: 'FedEx Ground' },
];

export const PACKAGE_TYPES = [
  { value: 'YOUR_PACKAGING', label: 'Your Packaging' },
  { value: 'FEDEX_ENVELOPE', label: 'FedEx Envelope' },
  { value: 'FEDEX_PAK', label: 'FedEx Pak' },
  { value: 'FEDEX_BOX_SMALL', label: 'FedEx Small Box' },
  { value: 'FEDEX_BOX_MEDIUM', label: 'FedEx Medium Box' },
  { value: 'FEDEX_BOX_LARGE', label: 'FedEx Large Box' },
];

// Helper for status colors
export const getStatusColor = (status: ShipmentStatus) => {
  switch (status) {
    case ShipmentStatus.CREATED: return 'bg-gray-100 text-gray-800';
    case ShipmentStatus.SHIPPED: return 'bg-blue-100 text-blue-800';
    case ShipmentStatus.IN_TRANSIT: return 'bg-indigo-100 text-indigo-800';
    case ShipmentStatus.OUT_FOR_DELIVERY: return 'bg-purple-100 text-purple-800';
    case ShipmentStatus.DELIVERED: return 'bg-green-100 text-green-800';
    case ShipmentStatus.EXCEPTION: return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};
