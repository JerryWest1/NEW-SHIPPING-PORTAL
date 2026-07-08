
import { LabelGenerationRequest, Shipment, ShipmentStatus, Address } from '../types';
import { MOCK_SENDERS, MOCK_RECIPIENTS } from '../components/constants';
import { settingsService } from './settingsService';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';

const LOCAL_STORAGE_KEY = 'fedex_app_shipments';

const getStoredShipments = (): Shipment[] => {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveShipment = async (shipment: Shipment) => {
  // Save to LocalStorage for fallback
  const current = getStoredShipments();
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([shipment, ...current]));
  
  // Save to Firebase
  try {
    await addDoc(collection(db, 'shipments'), {
      ...shipment,
      createdAt: new Date() // Add timestamp for sorting
    });
  } catch (error) {
    console.error("Error saving shipment to Firebase:", error);
  }
};

const updateStoredShipment = (shipment: Shipment) => {
  const current = getStoredShipments();
  const index = current.findIndex(s => s.id === shipment.id);
  if (index !== -1) {
      current[index] = shipment;
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
  }
};

const removeStoredShipment = (id: string) => {
  const current = getStoredShipments();
  const filtered = current.filter(s => s.id !== id);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
};

export const n8nService = {
  // New method to test connectivity
  testConnection: async (url: string, action?: string): Promise<string> => {
     if (!url || !url.trim()) throw new Error("URL is empty");
     const cleanUrl = url.trim();
     const payload = {
           test: true,
           action: action || 'CONNECTION_TEST',
           message: "Connection Check from FedEx App",
           timestamp: new Date().toISOString()
     };
     
     console.log("Testing connection to:", cleanUrl);
     console.log("Payload:", JSON.stringify(payload));
     
     try {
       const response = await fetch(cleanUrl, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
         },
         credentials: 'omit',
         body: JSON.stringify(payload),
       });

       console.log("Response status:", response.status);
       
       if (!response.ok) {
         // ... (rest of the error handling)
         let errorDetails = response.statusText;
         try {
            const errorJson = await response.json();
            if (errorJson && errorJson.message) {
                errorDetails = errorJson.message;
            } else {
                errorDetails = JSON.stringify(errorJson);
            }
         } catch (e) {
            try { errorDetails = await response.text(); } catch(e2) {}
         }
         
         if (cleanUrl.includes('webhook-test')) {
            throw new Error(`Test URL Error (${response.status}): ${errorDetails.substring(0, 200)}. \nDid you click 'Execute Workflow' in N8N?`);
         }
         
         throw new Error(`Server Error (${response.status}): ${errorDetails.substring(0, 200)}`);
       }
       
       return "Success! Connection established.";
     } catch (error: any) {
        console.error("Connectivity Test Failed:", error);
        
        if (error.message.includes('Error')) throw error;
        
        throw new Error(`Connection Failed: ${error.message}`);
     }
  },

  createLabel: async (request: LabelGenerationRequest): Promise<Shipment> => {
    console.log("CreateLabel request:", request);
    console.log("CreateLabel request options:", request.options);
    const settings = await settingsService.getSettings();

    // 1. Resolve Addresses
    const storedRecipients: Address[] = JSON.parse(localStorage.getItem('fedex_recipients') || '[]');
    const storedSenders: Address[] = JSON.parse(localStorage.getItem('fedex_senders') || '[]');

    const allRecipients = [...storedRecipients, ...MOCK_RECIPIENTS];
    const allSenders = [...storedSenders, ...MOCK_SENDERS];

    const fullSender = allSenders.find(s => s.id === request.senderId);
    const fullRecipient = allRecipients.find(r => r.id === request.recipientId);

    if (!fullSender || !fullRecipient) {
        throw new Error("Validation Failed: Could not find full address details for the selected Sender or Recipient.");
    }

    // 2. Prepare Payload
    const webhookPayload = {
        ...request,
        sender: fullSender,
        recipient: fullRecipient,
        timestamp: new Date().toISOString(),
        source: 'FedEx Label Manager',
        submittedBy: {
            id: request.createdBy,
            email: request.createdByEmail,
            name: request.createdByName
        },
        userEmail: request.createdByEmail,
        userName: request.createdByName
    };

    // If a webhook URL is provided, try to use it
    if (settings.n8nWebhookUrl && settings.n8nWebhookUrl.trim() !== '') {
      const cleanUrl = settings.n8nWebhookUrl.trim();
      
      try {
        console.log("Sending payload to N8N:", webhookPayload);
        
        const response = await fetch(cleanUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          credentials: 'omit', // IMPORTANT: Matches working sample
          body: JSON.stringify(webhookPayload),
        });

        let data: any = {};

        if (!response.ok) {
           console.warn(`N8N Webhook returned ${response.status}. Assuming n8n is processing in background and will write to Firebase.`);
        }
        
        // Try to parse JSON normally, but don't fail if it's not JSON
        try {
          data = await response.json();
          console.log("N8N Response Data:", data);
        } catch (e) {
          console.warn("N8N response was not JSON. Proceeding with defaults.");
          data = {};
        }
        
        // Map fields based on the specific N8N/Shippo response format
        // We DO NOT save this to Firebase here anymore, as n8n handles the DB write.
        // We just return a placeholder to satisfy the UI.
        const shipment: Shipment = {
           id: data.transaction_id || data.id || `req_${Date.now()}`,
           trackingNumber: data.tracking_number || data.trackingNumber || 'Processing...',
           reference: data.reference || request.reference,
           
           // If 'status' is SUCCESS from API, map to CREATED.
           status: (data.status === 'SUCCESS') ? ShipmentStatus.CREATED : (data.status as ShipmentStatus) || ShipmentStatus.CREATED,
           
           createdDate: data.created_at || new Date().toISOString(),
           sender: fullSender,
           recipient: fullRecipient,
           serviceType: data.service || request.serviceType,
           packageType: request.packageType,
           weight: request.weight,
           isReturnLabel: request.options.createReturnLabel,
           notifications: request.options.notifyEmails,
           createdBy: data.createdBy || request.createdBy,
           createdByEmail: data.createdByEmail || request.createdByEmail,
           createdByName: data.createdByName || request.createdByName,
           
           // Map specific keys from user's JSON
           labelUrl: data.label_url || data.url || '', 
           price: typeof data.cost === 'number' ? data.cost : parseFloat(data.cost || '0'),
           trackingUrl: data.tracking_url_provider || '',
           shippoTransactionId: data.transaction_id || ''
        };

        // DO NOT save to Firebase here. n8n will do it.
        // await saveShipment(shipment);
        console.log("Returning shipment:", shipment);
        return shipment;

      } catch (error: any) {
        console.error("N8N Network Error:", error);
        if (cleanUrl.includes('yourdomain.com')) {
           console.warn("Using placeholder URL, falling back to mock data.");
        } else {
           throw new Error(`Network Request Failed: ${error.message}`);
        }
      }
    }

    // --- MOCK FALLBACK (If no URL configured) ---
    await new Promise(resolve => setTimeout(resolve, 1500));

    const newShipment: Shipment = {
      id: `shp_${Date.now()}`,
      trackingNumber: `1234${Math.floor(Math.random() * 100000000)}`, // Mock Tracking
      reference: request.reference,
      status: ShipmentStatus.CREATED,
      createdDate: new Date().toISOString(),
      sender: fullSender,
      recipient: fullRecipient,
      serviceType: request.serviceType,
      packageType: request.packageType,
      weight: request.weight,
      isReturnLabel: request.options.createReturnLabel,
      notifications: request.options.notifyEmails,
      createdBy: request.createdBy,
      createdByEmail: request.createdByEmail,
      createdByName: request.createdByName,
      labelUrl: 'https://dummyimage.com/600x800/fff/000.png&text=FEDEX+LABEL+SAMPLE',
      price: Math.floor(Math.random() * 60) + 15.50
    };

    await saveShipment(newShipment);
    console.log("Returning mock shipment:", newShipment);
    return newShipment;
  },

  getRates: async (request: { sender: Address, recipient: Address, weight: number, dimensions: { l: number, w: number, h: number }, reference: string }): Promise<any[]> => {
    const settings = await settingsService.getSettings();
    if (!settings.getRatesWebhookUrl || settings.getRatesWebhookUrl.trim() === '') {
      throw new Error("Get Rates Webhook URL is not configured in Settings.");
    }

    try {
      const response = await fetch(settings.getRatesWebhookUrl.trim(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'omit',
        body: JSON.stringify({
          action: 'GET_RATES',
          ...request
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch rates: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Raw getRates response:", data);
      // Handle response if it's an array containing the rates object
      if (Array.isArray(data) && data.length > 0 && data[0].rates) {
        console.log("Returning rates from array:", data[0].rates);
        return data[0].rates;
      }
      console.log("Returning rates from object:", data.rates);
      return data.rates || [];
    } catch (error: any) {
      console.error("Get Rates Error:", error);
      throw new Error(`Failed to fetch rates: ${error.message}`);
    }
  },

  resendLabel: async (shipment: Shipment): Promise<Shipment> => {
     const settings = await settingsService.getSettings();
     if (!settings.resendLabelWebhookUrl || settings.resendLabelWebhookUrl.trim() === '') {
         throw new Error("Resend Label Webhook URL is not configured in Settings.");
     }

     // --- FETCH LATEST EMAIL LOGIC ---
     // 1. Get current address book data
     const storedSenders: Address[] = JSON.parse(localStorage.getItem('fedex_senders') || '[]');
     // 2. Merge with mocks in case ID belongs to a mock
     const allSenders = [...storedSenders, ...MOCK_SENDERS];
     
     // 3. Find the profile by ID
     const currentSenderProfile = allSenders.find(s => s.id === shipment.sender.id);
     
     // 4. Use latest email if found, otherwise fallback to historical snapshot
     const latestSenderEmail = currentSenderProfile ? currentSenderProfile.email : shipment.sender.email;

     try {
        const response = await fetch(settings.resendLabelWebhookUrl.trim(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          credentials: 'omit',
          body: JSON.stringify({
              action: 'RESEND_LABEL',
              trackingNumber: shipment.trackingNumber,
              recipientEmail: shipment.recipient.email,
              senderEmail: latestSenderEmail, // Sends the UP-TO-DATE email
              labelUrl: shipment.labelUrl,
              shipmentData: {
                  ...shipment,
                  sender: {
                      ...shipment.sender,
                      email: latestSenderEmail // Updates nested object as well for consistency
                  }
              }
          }),
        });
        
        // Update local record with timestamp
        const updatedShipment = {
            ...shipment,
            lastResentDate: new Date().toISOString()
        };
        updateStoredShipment(updatedShipment);

        return updatedShipment;
     } catch (error: any) {
        console.error("Resend Label Error:", error);
        throw new Error(`Failed to trigger resend webhook: ${error.message}`);
     }
  },

  getHistory: async (): Promise<Shipment[]> => {
    // Simulate Network Latency
    await new Promise(resolve => setTimeout(resolve, 500));
    return getStoredShipments();
  },
  
  refreshTracking: async (trackingNumber: string): Promise<ShipmentStatus> => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const statuses = Object.values(ShipmentStatus);
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    return randomStatus;
  },

  deleteShipment: async (shipment: Shipment, deletedByName: string, deletedByEmail: string): Promise<void> => {
    const settings = await settingsService.getSettings();
    console.log("Delete Shipment Settings:", settings);
    
    if (settings.deleteShipmentWebhookUrl && settings.deleteShipmentWebhookUrl.trim() !== '') {
        const url = settings.deleteShipmentWebhookUrl.trim();
        console.log("Triggering delete shipment webhook at:", url);
        console.log("Shipment object keys:", Object.keys(shipment));
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'omit',
                body: JSON.stringify({
                    action: 'DELETE_SHIPMENT',
                    trackingNumber: shipment.trackingNumber,
                    shipmentId: shipment.id,
                    shippoTransactionId: shipment.shippoTransactionId,
                    deletedByName: deletedByName,
                    deletedByEmail: deletedByEmail,
                    recipient: (shipment as any).recipient?.name || (shipment as any).recipientName || (shipment as any).recipient || 'Unknown',
                    reference: shipment.reference || (shipment as any).property || '',
                    createdAt: (shipment.createdDate && typeof shipment.createdDate === 'object' && 'toDate' in (shipment.createdDate as any))
                        ? (shipment.createdDate as any).toDate()
                        : (shipment.createdDate || (shipment as any).createdAt || new Date().toISOString())
                })
            });
            console.log("Webhook response status:", response.status);
            if (!response.ok) {
                console.error("Webhook returned error status:", response.status, await response.text());
            }
        } catch (error) {
            console.error("Error triggering delete shipment webhook:", error);
        }
    } else {
        console.warn("Delete Shipment Webhook URL is not configured.");
    }
    
    // Delete from Firebase
    try {
        await deleteDoc(doc(db, 'shipments', shipment.id));
    } catch (error) {
        console.error("Error deleting shipment from Firebase:", error);
    }
    
    removeStoredShipment(shipment.id);
  }
};
