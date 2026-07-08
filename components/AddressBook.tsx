import React, { useState, useEffect } from 'react';
import { Plus, Search, MapPin, Trash2, Pencil, Package, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Address } from '../types';
import { AddressForm } from './AddressForm';

// Firebase Configuration removed - using shared instance from ../lib/firebase

interface AddressBookProps {
  onGenerateLabel?: (recipient: Address) => void;
  recipients: Address[];
  senders: Address[];
  onUpdateRecipients: (recipients: Address[]) => void;
  onUpdateSenders: (senders: Address[]) => void;
  loading?: boolean;
  initialSearchTerm?: string;
  customRecipientTypes: string[];
  onUpdateSettings: (types: string[]) => void;
}

export const AddressBook: React.FC<AddressBookProps> = ({ 
  onGenerateLabel,
  recipients,
  senders,
  onUpdateRecipients,
  onUpdateSenders,
  loading = false,
  initialSearchTerm = '',
  customRecipientTypes,
  onUpdateSettings
}) => {
  const formatPhoneNumber = (phoneNumberString?: string) => {
    if (!phoneNumberString) return '';
    const cleaned = ('' + phoneNumberString).replace(/\D/g, '');
    const match = cleaned.match(/^(?:1)?(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]})-${match[2]}-${match[3]}`;
    }
    return phoneNumberString;
  };

  const [activeTab, setActiveTab] = useState<'RECIPIENT' | 'SENDER'>('RECIPIENT');
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);

  useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Address | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingContact, setDeletingContact] = useState<{id: string, name: string} | null>(null);

  // Get current list based on tab
  const data = activeTab === 'RECIPIENT' ? recipients : senders;
  
  // Filter based on search
  const filteredData = data.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.recipientType?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Save address (new or edit)
  const handleSaveAddress = async (address: Address) => {
    console.log("Attempting to save address:", address);
    try {
      setSavingId(address.id || 'new');
      
      const addressData = {
        type: address.type,
        name: address.name,
        company: address.company || '',
        street1: address.street1,
        street2: address.street2 || '',
        city: address.city,
        state: address.state,
        zip: address.zip,
        country: address.country,
        phone: address.phone || '',
        email: address.email || '',
        recipientType: address.type === 'RECIPIENT' ? (address.recipientType || '') : '',
      };
      console.log("Address data to save:", addressData);

      if (editingContact?.id) {
        // Update existing
        console.log('Updating address in Firestore:', editingContact.id);
        await updateDoc(doc(db, 'addresses', address.id), addressData);
        console.log('Update successful');
        
        if (address.type === 'RECIPIENT') {
          onUpdateRecipients(recipients.map(r => r.id === address.id ? { ...addressData, id: address.id } as Address : r));
        } else {
          onUpdateSenders(senders.map(s => s.id === address.id ? { ...addressData, id: address.id } as Address : s));
        }
      } else {
        // Create new
        console.log('Adding new address to Firestore');
        const docRef = await addDoc(collection(db, 'addresses'), addressData);
        console.log('Add successful, new ID:', docRef.id);
        const newAddress = { ...addressData, id: docRef.id } as Address;
        
        if (address.type === 'RECIPIENT') {
          onUpdateRecipients([...recipients, newAddress].sort((a, b) => a.name.localeCompare(b.name)));
        } else {
          onUpdateSenders([...senders, newAddress].sort((a, b) => a.name.localeCompare(b.name)));
        }
      }
      
      setEditingContact(null);
      setIsAddModalOpen(false);
    } catch (err) {
      console.error('Error saving address:', err);
      alert('Failed to save address: ' + (err as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  // Delete address
  const confirmDelete = async () => {
    if (!deletingContact) return;
    const { id, name } = deletingContact;

    try {
      setDeletingId(id);
      console.log('Deleting address from Firestore:', id);
      await deleteDoc(doc(db, 'addresses', id));
      console.log('Delete successful in Firestore');
      
      if (activeTab === 'RECIPIENT') {
        onUpdateRecipients(recipients.filter(r => r.id !== id));
      } else {
        onUpdateSenders(senders.filter(s => s.id !== id));
      }
      setDeletingContact(null);
    } catch (err) {
      console.error('Error deleting address:', err);
      alert('Failed to delete address: ' + (err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddClick = () => {
    setEditingContact(null);
    setIsAddModalOpen(true);
  };

  const handleEditClick = (contact: Address) => {
    setEditingContact(contact);
    setIsAddModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 flex-shrink-0">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Address Book</h2>
          <p className="text-slate-500 font-medium">Manage your shipping contacts and origin locations</p>
        </div>
        
        <button 
          onClick={handleAddClick}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-900/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 font-bold"
        >
          <Plus size={20} />
          <span>Add New Contact</span>
        </button>
      </div>

      {/* Tabs */}
      {!loading && (
        <>
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit mb-6 flex-shrink-0">
            <button
              onClick={() => {
                setActiveTab('RECIPIENT');
                setSearchTerm('');
              }}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'RECIPIENT'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Recipients ({recipients.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('SENDER');
                setSearchTerm('');
              }}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'SENDER'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Senders ({senders.length})
            </button>
          </div>

          {/* Search & Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex-shrink-0">
              <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Search by name, company, or city..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {activeTab === 'RECIPIENT' ? (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50/50 sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Name / Company</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Type</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Address</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Email and Phone</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-widest">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100">
                        {filteredData.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-20 text-center">
                              <div className="flex flex-col items-center gap-3">
                                <div className="p-4 bg-slate-50 rounded-full">
                                  <Search size={32} className="text-slate-300" />
                                </div>
                                <p className="text-slate-500 font-medium">No addresses found. Add one manually.</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredData.map((addr) => (
                            <tr key={addr.id} className="hover:bg-slate-50/50 group transition-colors">
                              <td className="px-6 py-5 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="h-11 w-11 flex-shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl flex items-center justify-center font-bold shadow-sm">
                                    {addr.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-bold text-slate-900">{addr.name}</div>
                                    <div className="text-xs font-medium text-slate-500">{addr.company}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-5 whitespace-nowrap">
                                {addr.recipientType ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                                    {addr.recipientType}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 text-xs">-</span>
                                )}
                              </td>
                              <td className="px-6 py-5 whitespace-nowrap">
                                <div className="flex items-start gap-2 text-sm text-slate-600">
                                  <MapPin size={16} className="mt-0.5 text-indigo-400 flex-shrink-0" />
                                  <div>
                                    <p className="font-semibold">{addr.street1} {addr.street2}</p>
                                    <p className="text-slate-500 text-xs">{addr.city}, {addr.state} {addr.zip}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-5 whitespace-nowrap">
                                <div className="text-sm">
                                  <p className="font-medium text-slate-900">
                                    {addr.email ? (
                                      <a href={`mailto:${addr.email}`} className="text-indigo-600 hover:underline">
                                        {addr.email}
                                      </a>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-0.5">{formatPhoneNumber(addr.phone) || <span className="text-slate-300">-</span>}</p>
                                </div>
                              </td>
                              <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end gap-2">
                                  {onGenerateLabel && (
                                    <button 
                                      onClick={() => onGenerateLabel(addr)}
                                      className="text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg inline-flex items-center gap-2 transition-all shadow-md shadow-indigo-100 font-bold text-xs"
                                    >
                                      <Package size={14} />
                                      <span>Label</span>
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => handleEditClick(addr)}
                                    className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition-all"
                                    title="Edit Contact"
                                  >
                                    <Pencil size={18} />
                                  </button>
                                  <button 
                                    onClick={() => setDeletingContact({id: addr.id, name: addr.name})}
                                    className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-all"
                                    title="Delete Contact"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile/Tablet Cards */}
                  <div className="md:hidden divide-y divide-slate-200">
                    {filteredData.length === 0 ? (
                      <div className="p-12 text-center text-slate-500">
                        No addresses found.
                      </div>
                    ) : (
                      filteredData.map((addr) => (
                        <div key={addr.id} className="p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-slate-900">{addr.name}</div>
                              <div className="text-sm text-slate-500">{addr.company || 'No Company'}</div>
                            </div>
                            {addr.recipientType && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                {addr.recipientType}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">
                            {addr.street1} {addr.street2}, {addr.city}, {addr.state} {addr.zip}
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                            {onGenerateLabel && (
                              <button onClick={() => onGenerateLabel(addr)} className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-medium">Label</button>
                            )}
                            <button onClick={() => handleEditClick(addr)} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium">Edit</button>
                            <button onClick={() => setDeletingContact({id: addr.id, name: addr.name})} className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-medium">Delete</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredData.length === 0 ? (
                    <div className="col-span-full py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 bg-slate-50 rounded-full">
                          <Search size={32} className="text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-medium">No senders found. Add one manually.</p>
                      </div>
                    </div>
                  ) : (
                    filteredData.map((addr) => (
                      <div key={addr.id} className="bg-white p-6 rounded-[32px] border-2 border-[#4D148C] shadow-sm hover:shadow-xl transition-all group relative flex flex-col h-full min-h-[220px] transform hover:-translate-y-1">
                        <div className="flex justify-between items-start mb-6">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-[#4D148C] text-white rounded-2xl flex items-center justify-center font-bold text-lg shadow-lg shadow-indigo-100">
                              {addr.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="text-lg font-bold text-slate-900 leading-tight">{addr.name}</h4>
                              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-0.5">{addr.company || 'Central Hub'}</p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button 
                              onClick={() => handleEditClick(addr)}
                              className="text-slate-300 hover:text-[#4D148C] p-2 hover:bg-indigo-50 rounded-full transition-all"
                              title="Edit"
                            >
                              <Pencil size={18} />
                            </button>
                            <button 
                              onClick={() => setDeletingContact({id: addr.id, name: addr.name})}
                              className="text-slate-300 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition-all"
                              title="Delete"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>

                        <div className="flex-1">
                          <div className="text-slate-600 text-sm space-y-1 font-medium bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div className="flex items-start gap-2">
                              <MapPin size={14} className="text-[#4D148C] mt-0.5" />
                              <div>
                                <p className="font-bold text-slate-800">{addr.street1} {addr.street2}</p>
                                <p className="text-xs">{addr.city}, {addr.state} {addr.zip}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <AddressForm 
              initialData={editingContact || { type: activeTab }}
              type={editingContact?.type || activeTab}
              onSave={handleSaveAddress}
              onCancel={() => {
                setIsAddModalOpen(false);
                setEditingContact(null);
              }}
              customRecipientTypes={customRecipientTypes}
              onUpdateSettings={onUpdateSettings}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingContact && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Delete Contact?</h3>
              <p className="text-slate-500 mb-8">
                Are you sure you want to delete <span className="font-bold text-slate-900">{deletingContact.name}</span>? This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setDeletingContact(null)}
                  className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={!!deletingId}
                  className="flex-1 px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-red-900/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deletingId ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Delete Now'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
