import React, { useState, useEffect } from 'react';
import { Search, Package, Eye, Trash2, ChevronDown, Printer, X, Edit2, Check } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { n8nService } from '../services/n8nService';
import { settingsService } from '../services/settingsService';
import { AddressAutocomplete } from './AddressAutocomplete';

// Firebase Configuration removed - using shared instance from ../lib/firebase

interface TrackingEvent {
  timestamp: string;
  status: string;
  location: string;
  description: string;
}

interface Shipment {
  id: string;
  trackingNumber: string;
  property?: string;
  recipientName?: string;
  currentStatus?: string;
  createdAt?: any;
  labelUrl?: string;
  carrier?: string;
  statusDetails?: string;
  requesterEmail?: string;
  price?: number;
  createdByEmail?: string;
  trackingHistory?: TrackingEvent[];
  reference?: string;
  referenceEditedBy?: string;
  referenceEditedAt?: string;
  [key: string]: any;
}

interface ShipmentHistoryProps {
  showSummary?: boolean;
  onNavigateToContact?: (contactName: string) => void;
  initialSearchTerm?: string;
}

export const ShipmentHistory: React.FC<ShipmentHistoryProps> = ({ 
  showSummary = true,
  onNavigateToContact,
  initialSearchTerm
}: ShipmentHistoryProps) => {
  const { user: currentUser } = useAuth();
  const isPriceAuthorized = currentUser?.email?.toLowerCase() === 'jerry@westmarq.com';
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [resendLabelWebhookUrl, setResendLabelWebhookUrl] = useState<string>('');
  const [editingReferenceId, setEditingReferenceId] = useState<string | null>(null);
  const [tempReference, setTempReference] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // Temp function to fix stamps
  const fixStamps = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'shipments'));
      let updated = 0;
      for (const docSnapshot of querySnapshot.docs) {
        const data = docSnapshot.data();
        if (data.referenceStamp && typeof data.referenceStamp === 'string') {
          let needsUpdate = false;
          let newName = 'Jerry';
          let newStamp = data.referenceStamp;
          
          // Replace "Edited by User" with "Edited by Jerry"
          if (newStamp.includes('Edited by User')) {
            newStamp = newStamp.replace('Edited by User', `Edited by ${newName}`);
            needsUpdate = true;
          }
          
          // If it somehow contains the email, replace with name
          if (newStamp.includes('Jerry@westmarq.com')) {
            newStamp = newStamp.replace('Jerry@westmarq.com', newName);
            needsUpdate = true;
          }
          
          if (needsUpdate) {
            await updateDoc(docSnapshot.ref, {
              referenceEditedBy: newName,
              referenceStamp: newStamp
            });
            updated++;
          }
        }
      }
      alert(`Updated ${updated} shipments.`);
    } catch (err) {
      console.error(err);
      alert('Error fixing stamps.');
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await settingsService.getSettings();
      setResendLabelWebhookUrl(settings.resendLabelWebhookUrl || '');
    };
    loadSettings();
  }, []);

  useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const selectedShipment = shipments.find(s => s.id === selectedShipmentId) || null;
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [historySortOrder, setHistorySortOrder] = useState<'asc' | 'desc'>('desc');
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Fetch shipments from Firebase in real-time
  useEffect(() => {
    setLoading(true);
    setError(null);
    
    console.log('Setting up real-time listener for shipments from Firebase...');
    const shipmentsCollection = collection(db, 'shipments');
    
    const unsubscribe = onSnapshot(shipmentsCollection, (snapshot) => {
      const data: Shipment[] = [];
      snapshot.forEach((doc) => {
        const docData = doc.data();
        console.log('Document Data:', docData);
        data.push({
          id: doc.id,
          ...docData,
          price: typeof docData.cost === 'string' ? parseFloat(docData.cost) : (docData.cost || 0)
        } as Shipment);
      });

      // Fallback to localStorage if Firebase is empty
      if (data.length === 0) {
        const stored = localStorage.getItem('fedex_app_shipments');
        if (stored) {
          const localData = JSON.parse(stored);
          data.push(...localData);
        }
      }

      console.log(`Found ${data.length} shipments`, data);
      setShipments(data.sort((a, b) => {
        const dateA = new Date(a.createdAt?.toDate?.() || a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt?.toDate?.() || b.createdAt || 0).getTime();
        return dateB - dateA;
      }));
      setLoading(false);
    }, (err) => {
      console.error('Error fetching shipments from Firebase:', err);
      setError(`Failed to load shipments. Please check console for details.`);
      setLoading(false);
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, []);

  // Format date
  const formatDate = (date: any) => {
    try {
      if (!date) return 'N/A';
      const d = date.toDate ? date.toDate() : new Date(date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    if (!status) return 'bg-slate-100 text-slate-800';
    if (status.includes('DELIVERED')) return 'bg-green-100 text-green-800';
    if (status.includes('TRANSIT')) return 'bg-blue-100 text-blue-800';
    if (status.includes('RETURN')) return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  // Resend label
  const handleResendLabel = async (shipment: Shipment) => {
    try {
      setResendingId(shipment.id);
      const payload = {
        action: "RESEND_LABEL",
        trackingNumber: shipment.trackingNumber,
        recipientEmail: shipment.requesterEmail || shipment.recipientEmail,
        senderEmail: shipment.requesterEmail || "support@example.com",
        labelUrl: shipment.labelUrl,
        shipmentData: shipment,
      };

      const response = await fetch(resendLabelWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        showNotification('Label resent successfully!', 'success');
      } else {
        showNotification('Failed to resend label. Please try again.', 'error');
      }
    } catch (err) {
      console.error('Error resending label:', err);
      showNotification('Error resending label', 'error');
    } finally {
      setResendingId(null);
    }
  };

  // Delete shipment
  const handleDeleteShipment = async (shipment: Shipment) => {
    console.log("Attempting to delete shipment:", shipment.id);
    if (!confirm(`Delete shipment ${shipment.trackingNumber}? This cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(shipment.id);
      console.log("Calling n8nService.deleteShipment for:", shipment.id);
      const userName = currentUser?.name || 'Unknown';
      const userEmail = currentUser?.email || 'Unknown';
      await n8nService.deleteShipment(shipment as any, userName, userEmail);
      console.log("n8nService.deleteShipment successful");
      setShipments(shipments.filter(s => s.id !== shipment.id));
      setSelectedShipmentId(null);
      showNotification('Shipment deleted successfully', 'success');
    } catch (err) {
      console.error('Error deleting shipment:', err);
      showNotification('Failed to delete shipment: ' + (err as Error).message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // Handle reference update
  const handleUpdateReference = async (shipmentId: string) => {
    if (!tempReference.trim() || isSaving) return;
    
    setIsSaving(true);
    try {
      const now = new Date();
      const userName = currentUser?.name || 'User';
      const stamp = `Edited by ${userName} on ${now.toLocaleDateString()} at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      
      const shipmentRef = doc(db, 'shipments', shipmentId);
      await updateDoc(shipmentRef, {
        reference: tempReference,
        property: tempReference, // Keep in sync with legacy 'property' field if needed
        referenceEditedBy: userName,
        referenceEditedAt: now.toISOString(),
        referenceStamp: stamp
      });
      
      showNotification('Reference updated successfully', 'success');
      setEditingReferenceId(null);
      setTempReference('');
    } catch (err) {
      console.error('Error updating reference:', err);
      showNotification('Failed to update reference', 'error');
    } finally {
      setIsSaving(false);
    }
  };
  const filteredShipments = shipments.filter(shipment => {
    const matchesSearch = 
      shipment.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.property?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.recipientName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || 
      (shipment.currentStatus && shipment.currentStatus.toUpperCase().includes(statusFilter.toUpperCase()));
    
    return matchesSearch && matchesStatus;
  });


  // Get initial tracking event from creation date
  const getInitialTrackingEvent = (shipment: Shipment) => {
    const createdAt = shipment.createdAt?.toDate?.() || new Date(shipment.createdAt || Date.now());
    return {
      timestamp: createdAt.toISOString(),
      status: 'Pre-Transit',
      location: shipment.sender?.city?.toUpperCase() || 'ORIGIN FACILITY',
      description: 'Label created'
    };
  };

  return (
    <div className="space-y-6">
      {/* Notification Banner */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {notification.message}
        </div>
      )}

        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Shipment History</h2>
            <p className="text-slate-500">Track and manage past shipments</p>
          </div>
          {isPriceAuthorized && <button onClick={fixStamps} className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200">Fix Stamps</button>}
        </div>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search tracking #, reference, or recipient..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <div className="w-full md:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="PRE_TRANSIT">Pre-Transit</option>
              <option value="TRANSIT">In Transit</option>
              <option value="DELIVERED">Delivered</option>
              <option value="EXCEPTION">Exception</option>
              <option value="RETURN">Return</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="inline-block animate-spin">
            <Package className="text-indigo-600" size={32} />
          </div>
          <p className="mt-4 text-slate-600">Loading shipments...</p>
        </div>
      )}

      {/* Shipments Table (Desktop) */}
      {!loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">DATE of Shipping</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tracking</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Reference</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Recipient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Carrier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Created By</th>
                  {isPriceAuthorized && <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Price</th>}
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Return</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredShipments.length === 0 ? (
                  <tr>
                    <td colSpan={isPriceAuthorized ? 10 : 9} className="px-6 py-12 text-center text-slate-500">
                      {searchTerm ? 'No shipments found matching your search.' : 'No shipments found.'}
                    </td>
                  </tr>
                ) : (
                  filteredShipments.map((shipment) => (
                    <tr key={shipment.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{formatDate(shipment.createdAt)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <a href={`https://www.fedex.com/fedextrack/?trknbr=${shipment.trackingNumber}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 font-mono text-xs hover:underline">{shipment.trackingNumber}</a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingReferenceId === shipment.id ? (
                          <div className="flex items-center gap-2 max-w-[250px]">
                            <div className="flex-1">
                              <AddressAutocomplete
                                label=""
                                value={tempReference}
                                onChange={(e) => setTempReference(e.target.value)}
                                onSelect={(addr) => setTempReference(addr.street1)}
                                placeholder="Street name..."
                                className="!mb-0"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => handleUpdateReference(shipment.id)}
                                disabled={isSaving}
                                className="p-1.5 bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors"
                              >
                                {isSaving ? <Package className="animate-spin" size={14} /> : <Check size={14} />}
                              </button>
                              <button 
                                onClick={() => setEditingReferenceId(null)}
                                className="p-1.5 bg-slate-50 text-slate-400 rounded-md hover:bg-slate-100 transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="group flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-600">
                                {shipment.reference || shipment.property || '-'}
                              </span>
                              {(!shipment.reference && !shipment.property) && (
                                <button 
                                  onClick={() => {
                                    setEditingReferenceId(shipment.id);
                                    setTempReference('');
                                  }}
                                  className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 p-1.5 rounded-full hover:bg-indigo-100 transition-colors border border-indigo-200"
                                >
                                  <Edit2 size={14} />
                                </button>
                              )}
                            </div>
                            {shipment.referenceStamp && (
                              <span className="text-[10px] text-slate-400 mt-0.5 font-medium leading-tight">
                                {shipment.referenceStamp}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {(() => {
                          const name = shipment.recipientName?.trim() || shipment.recipient?.name?.trim();
                          const company = shipment.recipientCompany?.trim() || shipment.recipient?.company?.trim();
                          if (!name) return '-';
                          return (
                            <div className="cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => onNavigateToContact?.(name)}>
                              <div className="font-medium text-slate-900">{name}</div>
                              {company && <div className="text-xs text-slate-500">{company}</div>}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{shipment.carrier || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(shipment.currentStatus)}`}>
                          {shipment.currentStatus || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">{shipment.createdBy || shipment.createdByEmail || 'System'}</td>
                      {isPriceAuthorized && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {shipment.price ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(shipment.price) : '-'}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <input type="checkbox" checked={!!shipment.isReturnLabel} disabled className="h-4 w-4 text-black rounded border-slate-300 focus:ring-black opacity-100" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-2">
                        <button onClick={() => shipment.labelUrl && window.open(shipment.labelUrl, '_blank')} disabled={!shipment.labelUrl || shipment.currentStatus?.toLowerCase() !== 'pre_transit'} className="text-slate-600 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded transition-colors disabled:opacity-30"><Printer size={18} /></button>
                        <button onClick={() => setSelectedShipmentId(shipment.id)} className="text-indigo-600 hover:text-indigo-900 p-1.5 hover:bg-indigo-50 rounded transition-colors"><Eye size={18} /></button>
                        <button onClick={() => handleDeleteShipment(shipment)} disabled={deletingId === shipment.id || shipment.currentStatus?.toLowerCase() !== 'pre_transit'} className="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded transition-colors disabled:opacity-30"><Trash2 size={18} /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile/Tablet Cards */}
          <div className="md:hidden divide-y divide-slate-200">
            {filteredShipments.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                {searchTerm ? 'No shipments found matching your search.' : 'No shipments found.'}
              </div>
            ) : (
              filteredShipments.map((shipment) => (
                <div key={shipment.id} className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-slate-900">{shipment.recipientName || shipment.recipient?.name || 'Unknown'}</div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-500">{shipment.reference || shipment.property || 'No Reference'}</span>
                            {(!shipment.reference && !shipment.property) && (
                              <button 
                                onClick={() => {
                                  setEditingReferenceId(shipment.id);
                                  setTempReference('');
                                }}
                                className="text-indigo-500"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                          </div>
                          {shipment.referenceStamp && (
                            <span className="text-[9px] text-slate-400 font-medium">
                              {shipment.referenceStamp}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(shipment.currentStatus)}`}>
                        {shipment.currentStatus || 'Unknown'}
                      </span>
                    </div>

                    {/* Mobile Editing Interface */}
                    {editingReferenceId === shipment.id && (
                      <div className="bg-slate-50 p-3 rounded-lg flex flex-col gap-3 mt-2 border border-slate-100 shadow-inner">
                        <AddressAutocomplete
                          label="Reference (Street only)"
                          value={tempReference}
                          onChange={(e) => setTempReference(e.target.value)}
                          onSelect={(addr) => setTempReference(addr.street1)}
                          placeholder="Select address..."
                        />
                        <div className="flex gap-2 justify-end">
                          <button 
                            onClick={() => setEditingReferenceId(null)}
                            className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={() => handleUpdateReference(shipment.id)}
                            disabled={isSaving}
                            className="bg-indigo-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                          >
                            {isSaving && <Package className="animate-spin" size={14} />}
                            Save Reference
                          </button>
                        </div>
                      </div>
                    )}
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{formatDate(shipment.createdAt)}</span>
                    <a href={`https://www.fedex.com/fedextrack/?trknbr=${shipment.trackingNumber}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-mono">{shipment.trackingNumber}</a>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setSelectedShipmentId(shipment.id)} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium flex items-center gap-1">
                      <Eye size={14} /> View
                    </button>
                    {shipment.labelUrl && (
                      <button 
                        onClick={() => window.open(shipment.labelUrl, '_blank')} 
                        disabled={shipment.currentStatus?.toLowerCase() !== 'pre_transit'}
                        className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 disabled:opacity-30"
                      >
                        <Printer size={14} /> Print
                      </button>
                    )}
                    <button 
                      onClick={() => handleDeleteShipment(shipment)} 
                      disabled={deletingId === shipment.id || shipment.currentStatus?.toLowerCase() !== 'pre_transit'}
                      className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-medium flex items-center gap-1 disabled:opacity-30"
                    >
                      <Trash2 size={14} /> {deletingId === shipment.id ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      {showSummary && !loading && shipments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-slate-600 text-sm">Total Shipments</div>
            <div className="text-2xl font-bold text-slate-900">{shipments.length}</div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-slate-600 text-sm">In Transit</div>
            <div className="text-2xl font-bold text-blue-600">
              {shipments.filter(s => s.currentStatus?.includes('TRANSIT') && !s.currentStatus?.includes('PRE_TRANSIT')).length}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-slate-600 text-sm">Delivered</div>
            <div className="text-2xl font-bold text-green-600">
              {shipments.filter(s => s.currentStatus?.includes('DELIVERED')).length}
            </div>
          </div>
        </div>
      )}

      {/* Travel History Modal */}
      {selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-light text-slate-800">Travel history</h3>
                <p className="text-sm text-slate-500 mt-1">Tracking #: {selectedShipment.trackingNumber}</p>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setHistorySortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="text-indigo-600 text-sm font-medium flex items-center gap-1"
                >
                  Sort by: {historySortOrder === 'asc' ? 'Ascending' : 'Descending'}
                  <ChevronDown size={14} className={`transition-transform ${historySortOrder === 'asc' ? 'rotate-180' : ''}`} />
                </button>
                <button
                  onClick={() => setSelectedShipmentId(null)}
                  className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-8 relative">
              {(() => {
                const history = selectedShipment.trackingHistory && selectedShipment.trackingHistory.length > 0
                  ? [...selectedShipment.trackingHistory]
                  : [getInitialTrackingEvent(selectedShipment)];

                history.sort((a, b) => {
                  const timeA = new Date(a.timestamp).getTime();
                  const timeB = new Date(b.timestamp).getTime();
                  return historySortOrder === 'asc' ? timeA - timeB : timeB - timeA;
                });

                if (history.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <Package className="mx-auto text-slate-300 mb-4" size={48} />
                      <p className="text-slate-500">No travel history available for this shipment yet.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-0 relative">
                    {/* Continuous Vertical Line - Positioned exactly behind the dots */}
                    <div className="absolute left-[16.75rem] top-6 bottom-6 w-px bg-slate-300 z-0" />

                    {/* Group events by date */}
                    {Object.entries(
                      history.reduce((acc: any, event) => {
                        const date = new Date(event.timestamp).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'numeric',
                          day: 'numeric',
                          year: '2-digit'
                        });
                        if (!acc[date]) acc[date] = [];
                        acc[date].push(event);
                        return acc;
                      }, {})
                    ).map(([date, events]: [string, any], groupIdx, groups) => (
                      <div key={date} className="relative z-10">
                        {events.map((event: any, idx: number) => {
                          const isFirstOverall = groupIdx === 0 && idx === 0;
                          const isFirstInGroup = idx === 0;
                          
                          return (
                            <div key={event.timestamp} className={`flex items-start ${isFirstInGroup && !isFirstOverall ? 'pt-8 pb-3' : 'py-3'}`}>
                              {/* Date Column */}
                              <div className="w-40 flex-shrink-0 pt-0.5">
                                {isFirstInGroup && (
                                  <span className="text-sm font-medium text-slate-700">{date}</span>
                                )}
                              </div>

                              {/* Time Column */}
                              <div className="w-24 flex-shrink-0 pt-0.5 text-right pr-6">
                                <span className="text-sm text-slate-500">
                                  {new Date(event.timestamp).toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                  })}
                                </span>
                              </div>

                              {/* Timeline Column (Dot only, line is absolute background) */}
                              <div className="relative flex flex-col items-center w-6 flex-shrink-0 self-stretch">
                                <div className={`z-10 w-2.5 h-2.5 rounded-full bg-slate-800 mt-1.5 relative ${event.status === 'Delivered' ? 'w-5 h-5 mt-0.5 bg-white border-2 border-slate-800 flex items-center justify-center' : ''}`}>
                                  {event.status === 'Delivered' && <div className="w-2 h-2 bg-slate-800 rounded-full" />}
                                </div>
                              </div>

                              {/* Description Column */}
                              <div className="flex-1 pl-6 pt-0.5">
                                <p className={`text-sm ${event.status === 'Delivered' ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                                  {event.description}
                                </p>
                              </div>

                              {/* Location Column */}
                              <div className="w-48 flex-shrink-0 pt-0.5 text-right">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                  {event.location}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setSelectedShipmentId(null)}
                className="px-6 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium shadow-sm"
              >
                Close
              </button>
              {selectedShipment.labelUrl && (
                <a
                  href={selectedShipment.labelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm flex items-center gap-2"
                >
                  <Package size={16} />
                  View Label
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};