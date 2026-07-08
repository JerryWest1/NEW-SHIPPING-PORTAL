
import { AppSettings } from '../types';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebaseService';

const DEFAULT_SETTINGS: AppSettings = {
  n8nWebhookUrl: '',
  resendLabelWebhookUrl: '',
  deleteShipmentWebhookUrl: '',
  inviteUserWebhookUrl: '',
  getRatesWebhookUrl: '',
  geoapifyApiKey: import.meta.env.VITE_GEOAPIFY_API_KEY || '', // Default fallback key
  customRecipientTypes: ['Title Company', 'Attorney', 'Seller'],
};

export const settingsService = {
  getSettings: async (): Promise<AppSettings> => {
    try {
      const docRef = doc(db, 'settings', 'global');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { ...DEFAULT_SETTINGS, ...docSnap.data() } as AppSettings;
      }
      return DEFAULT_SETTINGS;
    } catch (e) {
      console.error("Error fetching settings from Firestore:", e);
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings: async (settings: AppSettings): Promise<void> => {
    try {
      const docRef = doc(db, 'settings', 'global');
      await setDoc(docRef, settings, { merge: true });
    } catch (e) {
      console.error("Error saving settings to Firestore:", e);
      throw e;
    }
  }
};
