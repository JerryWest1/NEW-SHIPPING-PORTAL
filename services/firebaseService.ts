import { getFirestore, collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export { db };

export const subscribeToShipments = (callback: (shipments: any[]) => void, onError: (error: Error) => void) => {
  const shipmentsCollection = collection(db, 'shipments');
  return onSnapshot(shipmentsCollection, (snapshot) => {
    const shipments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(shipments);
  }, (error) => {
    console.error("Firebase subscription error:", error);
    onError(error);
  });
};

export const getShipmentByTrackingNumber = async (trackingNumber: string) => {
  const shipmentsCollection = collection(db, 'shipments');
  const q = query(shipmentsCollection, where('trackingNumber', '==', trackingNumber));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};
