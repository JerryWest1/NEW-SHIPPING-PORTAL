
export enum ShipmentStatus {
  CREATED = 'Created',
  SHIPPED = 'Shipped',
  IN_TRANSIT = 'In Transit',
  OUT_FOR_DELIVERY = 'Out for Delivery',
  DELIVERED = 'Delivered',
  EXCEPTION = 'Exception'
}

export enum ServiceType {
  FEDEX_PRIORITY_OVERNIGHT = 'fedex_priority_overnight',
  FEDEX_STANDARD_OVERNIGHT = 'fedex_standard_overnight',
  FEDEX_FIRST_OVERNIGHT = 'fedex_first_overnight',
  FEDEX_2_DAY = 'fedex_2_day',
  FEDEX_2_DAY_AM = 'fedex_2_day_am',
  FEDEX_EXPRESS_SAVER = 'fedex_express_saver',
  FEDEX_GROUND = 'fedex_ground',
}

export interface Address {
  id: string;
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
  email: string;
  type: 'SENDER' | 'RECIPIENT';
  recipientType?: string;
}

export interface TrackingEvent {
  timestamp: string;
  status: string;
  location: string;
  description: string;
}

export interface Shipment {
  id: string;
  trackingNumber: string;
  reference: string;
  status: ShipmentStatus;
  createdDate: string;
  sender: Address;
  recipient: Address;
  serviceType: string;
  packageType: string;
  weight: number;
  isReturnLabel: boolean;
  notifications: string[]; // List of emails to notify
  createdBy?: string; // User ID who created the shipment
  createdByEmail?: string; // Email of the user who created the shipment
  createdByName?: string; // Name of the user who created the shipment
  labelUrl?: string; // Mock URL for the PDF
  price?: number; // Cost of shipment
  trackingUrl?: string; // Real-time tracking link provider
  lastResentDate?: string; // Timestamp of when the label was last resent
  trackingHistory?: TrackingEvent[];
  shippoTransactionId?: string; // Transaction ID from Shippo
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  status?: 'active' | 'pending';
}

export interface LabelGenerationRequest {
  senderId: string;
  recipientId: string;
  reference: string;
  serviceType: string;
  rateId?: string;
  packageType: string;
  weight: number;
  dimensions: { l: number; w: number; h: number };
  options: {
    createReturnLabel: boolean;
    emailLabelToRecipient: boolean;
    notifyEmails: string[];
  };
  createdBy?: string;
  createdByEmail?: string;
  createdByName?: string;
}

export interface AppSettings {
  n8nWebhookUrl: string;
  resendLabelWebhookUrl: string;
  deleteShipmentWebhookUrl: string;
  inviteUserWebhookUrl: string;
  getRatesWebhookUrl: string;
  geoapifyApiKey: string;
  customRecipientTypes: string[];
}

export type ViewState = 'DASHBOARD' | 'SHIPMENTS' | 'ADDRESS_BOOK' | 'SETTINGS' | 'USER_MANAGEMENT' | 'PROFILE';
