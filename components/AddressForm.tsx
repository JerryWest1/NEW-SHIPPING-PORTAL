
import React, { useState, useEffect } from 'react';
import { Address } from '../types';
import { Save, Mail, Phone, Building, User, MapPin, X, AlertCircle, ArrowRightLeft } from 'lucide-react';
import { AddressAutocomplete } from './AddressAutocomplete';
import { InputField } from './InputField';

interface AddressFormProps {
  initialData?: Partial<Address>;
  type: 'SENDER' | 'RECIPIENT';
  onSave: (address: Address, saveToBook: boolean) => void;
  onCancel: () => void;
  enableSaveOption?: boolean; // If true, shows checkbox "Save to Address Book"
  customRecipientTypes: string[];
  onUpdateSettings: (types: string[]) => void;
}

export const AddressForm: React.FC<AddressFormProps> = ({ 
  initialData, 
  type: initialType, 
  onSave, 
  onCancel, 
  enableSaveOption = false,
  customRecipientTypes,
  onUpdateSettings
}) => {
  const [address, setAddress] = useState<Partial<Address>>({
    country: 'US',
    type: initialType,
    ...initialData
  });
  
  const [isCreatingNewType, setIsCreatingNewType] = useState(
    !!initialData?.recipientType && !customRecipientTypes.includes(initialData.recipientType)
  );
  const [customType, setCustomType] = useState(
    initialData?.recipientType && !customRecipientTypes.includes(initialData.recipientType) ? initialData.recipientType : ''
  );
  
  const [saveToBook, setSaveToBook] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!address.name?.trim()) newErrors.name = "Name is required";
    if (!address.street1?.trim()) newErrors.street1 = "Street address is required";
    if (!address.city?.trim()) newErrors.city = "City is required";
    if (!address.state?.trim()) newErrors.state = "State is required";
    if (!address.zip?.trim()) newErrors.zip = "Zip code is required";
    if (!address.phone?.trim()) newErrors.phone = "Phone number is required";
    if (!address.email?.trim()) {
      newErrors.email = "Email is required";
    } else if (!isValidEmail(address.email)) {
      newErrors.email = "Invalid email format";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const formatPhoneNumber = (phoneNumberString: string) => {
    if (!phoneNumberString) return '';
    const cleaned = ('' + phoneNumberString).replace(/\D/g, '');
    const match = cleaned.match(/^(?:1)?(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]})-${match[2]}-${match[3]}`;
    }
    return phoneNumberString;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (isCreatingNewType && customType && !customRecipientTypes.includes(customType)) {
      onUpdateSettings([...customRecipientTypes, customType]);
    }

    const finalAddress: Address = {
      id: address.id || `addr_${Date.now()}`,
      name: address.name || '',
      company: address.company || '',
      street1: address.street1 || '',
      street2: address.street2 || '',
      city: address.city || '',
      state: address.state || '',
      zip: address.zip || '',
      country: address.country || 'US',
      phone: formatPhoneNumber(address.phone || ''),
      email: address.email || '',
      type: address.type as 'SENDER' | 'RECIPIENT',
      recipientType: address.type === 'RECIPIENT' ? (isCreatingNewType ? customType : address.recipientType) : undefined
    };

    onSave(finalAddress, saveToBook);
  };

  const handleAddressSelect = (data: any) => {
    setAddress(prev => ({
      ...prev,
      street1: data.street1,
      city: data.city,
      state: data.state,
      zip: data.zip,
      country: data.country
    }));
    // Clear address errors when selected from autocomplete
    if (errors.street1 || errors.city || errors.state || errors.zip) {
      setErrors(prev => {
        const { street1, city, state, zip, ...rest } = prev;
        return rest;
      });
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-white">
      <div className="bg-slate-900 text-white p-6 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <User size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">
              {initialData?.id ? 'Edit Contact' : 'Add New Contact'}
            </h2>
            <p className="text-slate-400 text-sm">
              {address.type === 'SENDER' ? 'Origin Details' : 'Destination Details'}
            </p>
          </div>
        </div>
        <button onClick={onCancel} className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded-full">
          <X size={24} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 min-h-0 custom-scrollbar">
        <div className="space-y-8">
          {/* Section: Contact Type */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <ArrowRightLeft size={14} /> Contact Type
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setAddress({ ...address, type: 'RECIPIENT' })}
                className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  address.type === 'RECIPIENT'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                    : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${address.type === 'RECIPIENT' ? 'border-indigo-600' : 'border-slate-300'}`}>
                  {address.type === 'RECIPIENT' && <div className="w-2 h-2 bg-indigo-600 rounded-full" />}
                </div>
                Recipient
              </button>
              <button
                type="button"
                onClick={() => setAddress({ ...address, type: 'SENDER' })}
                className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  address.type === 'SENDER'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                    : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${address.type === 'SENDER' ? 'border-indigo-600' : 'border-slate-300'}`}>
                  {address.type === 'SENDER' && <div className="w-2 h-2 bg-indigo-600 rounded-full" />}
                </div>
                Sender
              </button>
            </div>
          </div>

          {/* Section: Identity */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <User size={14} /> Identity
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputField 
                label="Contact Name" 
                value={address.name} 
                onChange={(e) => {
                  setAddress({...address, name: e.target.value});
                  if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                }}
                placeholder="e.g. John Doe" 
                required={true}
                error={!!errors.name}
                icon={<User size={18} />}
              />
              <InputField 
                label="Company Name" 
                value={address.company} 
                onChange={(e) => setAddress({...address, company: e.target.value})}
                placeholder="e.g. Acme Inc." 
                icon={<Building size={18} />}
              />
            </div>
            
            {address.type === 'RECIPIENT' && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Recipient Type
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select
                    value={isCreatingNewType ? 'CREATE_NEW' : (address.recipientType || '')}
                    onChange={(e) => {
                      if (e.target.value === 'CREATE_NEW') {
                        setIsCreatingNewType(true);
                      } else {
                        setIsCreatingNewType(false);
                        setAddress({...address, recipientType: e.target.value});
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm bg-white shadow-sm hover:border-slate-400 transition-all"
                  >
                    <option value="">Select Type...</option>
                    {customRecipientTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    <option value="CREATE_NEW">+ Create New...</option>
                  </select>
                  
                  {isCreatingNewType && (
                    <input 
                      type="text"
                      value={customType}
                      onChange={(e) => setCustomType(e.target.value)}
                      placeholder="Enter custom type..."
                      className="w-full rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm shadow-sm"
                      autoFocus
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section: Address */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <MapPin size={14} /> Address
            </h3>
            <div className="grid grid-cols-1 gap-6">
              <AddressAutocomplete 
                label="Street Address" 
                value={address.street1 || ''} 
                onChange={(e) => {
                  setAddress({...address, street1: e.target.value});
                  if (errors.street1) setErrors(prev => ({ ...prev, street1: '' }));
                }}
                onSelect={handleAddressSelect}
                placeholder="Type to search address..." 
                required={true}
                className={errors.street1 ? 'error' : ''}
              />
              <InputField 
                label="Apt / Suite / Unit" 
                value={address.street2} 
                onChange={(e) => setAddress({...address, street2: e.target.value})}
                placeholder="Suite 400" 
                icon={<Building size={18} />}
              />
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="col-span-2">
                  <InputField 
                    label="City" 
                    value={address.city} 
                    onChange={(e) => {
                      setAddress({...address, city: e.target.value});
                      if (errors.city) setErrors(prev => ({ ...prev, city: '' }));
                    }}
                    placeholder="New York" 
                    required={true}
                    error={!!errors.city}
                  />
                </div>
                <InputField 
                  label="State" 
                  value={address.state} 
                  onChange={(e) => {
                    setAddress({...address, state: e.target.value});
                    if (errors.state) setErrors(prev => ({ ...prev, state: '' }));
                  }}
                  placeholder="NY" 
                  required={true}
                  error={!!errors.state}
                />
                <InputField 
                  label="Zip Code" 
                  value={address.zip} 
                  onChange={(e) => {
                    setAddress({...address, zip: e.target.value});
                    if (errors.zip) setErrors(prev => ({ ...prev, zip: '' }));
                  }}
                  placeholder="10001" 
                  required={true}
                  error={!!errors.zip}
                />
              </div>
              <InputField 
                label="Country" 
                value={address.country} 
                onChange={(e) => setAddress({...address, country: e.target.value})}
                placeholder="US" 
              />
            </div>
          </div>

          {/* Section: Contact */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Phone size={14} /> Contact Info
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputField 
                label="Email Address" 
                value={address.email} 
                onChange={(e) => {
                   setAddress({...address, email: e.target.value});
                   if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                }}
                placeholder="john@example.com" 
                type="email" 
                required={true}
                error={!!errors.email}
                icon={<Mail size={18} />}
              />
              <InputField 
                label="Phone Number" 
                value={address.phone} 
                onChange={(e) => {
                  setAddress({...address, phone: e.target.value});
                  if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
                }}
                onBlur={() => {
                  if (address.phone) {
                    setAddress({...address, phone: formatPhoneNumber(address.phone)});
                  }
                }}
                placeholder="(555) 123-4567" 
                type="tel" 
                required={true}
                error={!!errors.phone}
                icon={<Phone size={18} />}
              />
            </div>
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>
          
          {enableSaveOption && (
            <div className="pt-6 border-t border-slate-100">
               <label className="flex items-center gap-4 p-5 border-2 border-indigo-50 bg-indigo-50/30 rounded-2xl cursor-pointer hover:bg-indigo-50 transition-all group">
                  <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${saveToBook ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300 group-hover:border-indigo-400'}`}>
                    {saveToBook && <X size={16} className="text-white rotate-45" />}
                  </div>
                  <input 
                    type="checkbox" 
                    checked={saveToBook}
                    onChange={(e) => setSaveToBook(e.target.checked)}
                    className="hidden" 
                  />
                  <div>
                    <span className="font-bold text-slate-900">Save to Address Book</span>
                    <p className="text-xs text-slate-500">Save this contact for future shipments</p>
                  </div>
                </label>
            </div>
          )}

        </div>
      </form>

      <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end gap-3 shrink-0">
        <button 
          type="button" 
          onClick={onCancel}
          className="px-6 py-3 rounded-xl text-slate-600 hover:bg-slate-200 font-bold transition-all"
        >
          Cancel
        </button>
        <button 
          onClick={handleSubmit}
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xl shadow-indigo-900/20 flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <Save size={20} />
          {initialData?.id ? 'Update Contact' : 'Save Contact'}
        </button>
      </div>
    </div>
  );
};
