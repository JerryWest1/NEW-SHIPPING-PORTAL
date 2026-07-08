
import React, { useState, useEffect, useRef } from 'react';
import { X, Truck, Save, Loader2, AlertCircle, Plus, ChevronDown, Search } from 'lucide-react';
import { Address, LabelGenerationRequest, Shipment } from '../types';
import { SERVICE_TYPES, PACKAGE_TYPES, INTERNAL_USERS } from './constants';
import { n8nService } from '../services/n8nService';
import { AddressForm } from './AddressForm';
import { settingsService } from '../services/settingsService';
import { AddressAutocomplete } from './AddressAutocomplete';
import { useAuth } from '../contexts/AuthContext';

interface CreateLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedRecipient?: Address | null;
  onSuccess: (shipment: Shipment) => void;
  recipients: Address[];
  senders: Address[];
  onAddRecipient: (addr: Address) => Promise<Address | null>;
  onAddSender: (addr: Address) => Promise<Address | null>;
}

// Searchable Dropdown Component
const SearchableAddressSelect = ({ 
  label, 
  value, 
  onChange, 
  options, 
  onAddNew, 
  onEdit,
  placeholder 
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: Address[];
  onAddNew: () => void;
  onEdit?: (address: Address) => void;
  placeholder: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) => 
    opt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (opt.company && opt.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
    opt.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative" ref={wrapperRef}>
       <div className="flex justify-between items-center mb-1">
        <label className="block text-sm font-medium text-slate-700">{label}</label>
        <div className="flex gap-2">
            {selectedOption && onEdit && (
                <button 
                  type="button" 
                  onClick={() => onEdit(selectedOption)}
                  className="text-xs text-slate-600 hover:text-slate-800 flex items-center gap-1 font-medium bg-slate-100 px-2 py-1 rounded hover:bg-slate-200 transition-colors"
                >
                    Edit
                </button>
            )}
            <button 
                type="button" 
                onClick={onAddNew}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
            >
                <Plus size={12} /> New
            </button>
        </div>
      </div>
      
      <div 
        className="relative cursor-pointer"
        onClick={() => {
            if (!isOpen) {
                setIsOpen(true);
                setSearchTerm(''); 
            } else {
                setIsOpen(false);
            }
        }}
      >
        <div className={`w-full rounded-md border border-slate-300 p-2.5 bg-white flex items-center justify-between shadow-sm hover:border-indigo-400 transition-colors ${isOpen ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}`}>
            <span className={`block truncate ${selectedOption ? 'text-slate-700' : 'text-slate-400'}`}>
                {selectedOption 
                    ? `${selectedOption.name} ${selectedOption.recipientType ? `[${selectedOption.recipientType}] ` : ''}${selectedOption.company ? `(${selectedOption.company})` : ''} - ${selectedOption.city}, ${selectedOption.state}` 
                    : placeholder}
            </span>
            <ChevronDown size={16} className="text-slate-400" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
          <div className="p-2 sticky top-0 bg-white border-b border-slate-100" onClick={(e) => e.stopPropagation()}>
             <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input 
                    autoFocus
                    type="text"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500 bg-slate-50"
                    placeholder="Search name, company, city..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
          </div>
          {filteredOptions.length === 0 ? (
             <div className="p-3 text-sm text-slate-500 text-center">No results found</div>
          ) : (
             filteredOptions.map((opt) => (
                <div 
                    key={opt.id}
                    onClick={() => {
                        onChange(opt.id);
                        setIsOpen(false);
                        setSearchTerm('');
                    }}
                    className={`px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm border-b border-slate-50 last:border-0 ${opt.id === value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}
                >
                    <div className="font-medium">
                        {opt.name} 
                        {opt.recipientType && <span className="ml-2 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] uppercase font-bold">{opt.recipientType}</span>}
                        {opt.company && <span className="text-slate-500 font-normal ml-1">({opt.company})</span>}
                    </div>
                    <div className="text-xs text-slate-500">{opt.street1}, {opt.city}, {opt.state}</div>
                </div>
             ))
          )}
        </div>
      )}
    </div>
  );
};

export const CreateLabelModal: React.FC<CreateLabelModalProps> = ({
  isOpen,
  onClose,
  preSelectedRecipient,
  onSuccess,
  recipients,
  senders,
  onAddRecipient,
  onAddSender
}) => {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [senderId, setSenderId] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [reference, setReference] = useState('');
  
  // Defaults updated as requested
  const [selectedRateId, setSelectedRateId] = useState('');
  const [serviceType, setServiceType] = useState('fedex_standard_overnight');
  const [packageType, setPackageType] = useState('FEDEX_ENVELOPE');
  
  const [weight, setWeight] = useState(1);
  const [dimensions, setDimensions] = useState({ l: 13, w: 10, h: 1 }); // Default to Size 10 Manila
  const [rates, setRates] = useState<any[]>([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Update dimensions when package type changes
  useEffect(() => {
    const PACKAGE_DIMENSIONS: Record<string, { l: number; w: number; h: number }> = {
      YOUR_PACKAGING: { l: 13, w: 10, h: 1 },
      FEDEX_ENVELOPE: { l: 12.5, w: 9.5, h: 1 },
      FEDEX_PAK: { l: 15.5, w: 12, h: 1.5 },
      FEDEX_BOX_SMALL: { l: 12.38, w: 10.88, h: 1.5 },
      FEDEX_BOX_MEDIUM: { l: 13.25, w: 11.5, h: 2.38 },
      FEDEX_BOX_LARGE: { l: 17.5, w: 12.38, h: 3 },
    };

    if (PACKAGE_DIMENSIONS[packageType]) {
      setDimensions(PACKAGE_DIMENSIONS[packageType]);
    }
  }, [packageType]);
  
  const lastSync = useRef({ selectedRateId: '', serviceType: '' });
  const ratesRef = useRef(rates);

  useEffect(() => {
    ratesRef.current = rates;
  }, [rates]);
  
  // Synchronize serviceType and selectedRateId
  useEffect(() => {
    const currentRates = ratesRef.current;
    if (currentRates.length === 0) return;

    if (selectedRateId !== lastSync.current.selectedRateId) {
      // selectedRateId changed
      const selectedRate = currentRates.find(r => r.rateId === selectedRateId);
      if (selectedRate && selectedRate.serviceToken !== serviceType) {
        lastSync.current = { selectedRateId, serviceType: selectedRate.serviceToken };
        setServiceType(selectedRate.serviceToken);
      }
    } else if (serviceType !== lastSync.current.serviceType) {
      // serviceType changed
      const matchingRate = currentRates.find(r => r.serviceToken === serviceType);
      if (matchingRate && matchingRate.rateId !== selectedRateId) {
        lastSync.current = { selectedRateId: matchingRate.rateId, serviceType };
        setSelectedRateId(matchingRate.rateId);
      }
    }
  }, [selectedRateId, serviceType]);
  
  // Options
  const [createReturnLabel, setCreateReturnLabel] = useState(false);
  const [emailLabel, setEmailLabel] = useState(false);
  const [notifyEmails, setNotifyEmails] = useState<string[]>([]);
  
  const [error, setError] = useState('');

  // Fetch rates
  const fetchRates = async () => {
    if (!senderId || !recipientId || !reference) {
      setRates([]);
      return;
    }
    setLoadingRates(true);
    try {
      const sender = localSenders.find(s => s.id === senderId);
      const recipient = localRecipients.find(r => r.id === recipientId);
      if (sender && recipient) {
        const fetchedRates = await n8nService.getRates({
          sender,
          recipient,
          weight,
          dimensions,
          reference
        });
        console.log("Fetched rates in CreateLabelModal:", fetchedRates);
        setRates(fetchedRates);
        if (fetchedRates.length > 0) {
          console.log("Looking for default rate...");
          const defaultRate = fetchedRates.find(r => 
            r.service?.includes('Standard Overnight') && 
            r.pricingType?.includes('One Rate')
          );
          console.log("Found default rate:", defaultRate);
          setSelectedRateId(defaultRate ? defaultRate.rateId : fetchedRates[0].rateId);
        }
      }
    } catch (err) {
      console.error("Error fetching rates:", err);
      setError("Failed to fetch rates.");
    } finally {
      setLoadingRates(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, [senderId, recipientId, weight, dimensions, reference]);
  
  // Local/Temporary Address State
  // These lists include props.recipients/senders PLUS any one-offs created in this session that weren't saved to DB
  const [localRecipients, setLocalRecipients] = useState<Address[]>([]);
  const [localSenders, setLocalSenders] = useState<Address[]>([]);

  // Add Address Modal State
  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addAddressType, setAddAddressType] = useState<'SENDER' | 'RECIPIENT'>('RECIPIENT');
  const [customRecipientTypes, setCustomRecipientTypes] = useState<string[]>([]);

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await settingsService.getSettings();
      setCustomRecipientTypes(settings.customRecipientTypes || []);
    };
    loadSettings();
  }, []);

  const handleUpdateSettings = async (newTypes: string[]) => {
    const settings = await settingsService.getSettings();
    await settingsService.saveSettings({ ...settings, customRecipientTypes: newTypes });
    setCustomRecipientTypes(newTypes);
  };

  const [isInternalNotifyOpen, setIsInternalNotifyOpen] = useState(false);
  const internalNotifyRef = useRef<HTMLDivElement>(null);

  // Sync props with local state
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (internalNotifyRef.current && !internalNotifyRef.current.contains(event.target as Node)) {
        setIsInternalNotifyOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setLocalRecipients(prev => {
        // Merge prop recipients with existing local one-offs (if any)
        const existingIds = new Set(recipients.map(r => r.id));
        const oneOffs = prev.filter(r => !existingIds.has(r.id));
        return [...recipients, ...oneOffs];
    });
  }, [recipients]);

  useEffect(() => {
    setLocalSenders(prev => {
        const existingIds = new Set(senders.map(s => s.id));
        const oneOffs = prev.filter(s => !existingIds.has(s.id));
        return [...senders, ...oneOffs];
    });
  }, [senders]);

  // Initialize defaults
  useEffect(() => {
    if (isOpen) {
       // Reset or set defaults when modal opens
       
       // Handle Pre-selection (e.g. from Address Book "Label" button)
       if (preSelectedRecipient) {
          // Ensure the pre-selected recipient is in the local list
          setLocalRecipients(prev => {
            if (!prev.find(r => r.id === preSelectedRecipient.id)) {
              return [preSelectedRecipient, ...prev];
            }
            return prev;
          });
          setRecipientId(preSelectedRecipient.id);
       } else {
          // Default to blank if no pre-selection
          setRecipientId('');
       }
       
       // Default Sender to blank
       setSenderId('');
    }
  }, [isOpen, preSelectedRecipient]);

  const resetForm = () => {
    setReference('');
    setWeight(1);
    setSelectedRateId('');
    setPackageType('FEDEX_ENVELOPE');
    setCreateReturnLabel(false);
    setEmailLabel(false);
    setNotifyEmails([]);
    setSenderId('');
    setRecipientId('');
    setRates([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Friday check
    const today = new Date();
    if (today.getDay() === 5) {
      if (!confirm("This shipment if sent out today will be delivered on the next business day. If you need it sooner reach out to Jerry. Continue?")) {
        return;
      }
    }

    if (!reference) {
      setError('Reference number is required.');
      return;
    }
    
    if (!senderId || !recipientId) {
      setError('Both Sender and Recipient addresses are required.');
      return;
    }

    const selectedRate = rates.find(r => r.rateId === selectedRateId);
    if (!selectedRate) {
        setError('Please select a valid shipping rate.');
        return;
    }

    setLoading(true);
    try {
      const request: LabelGenerationRequest = {
        senderId,
        recipientId,
        reference,
        serviceType: selectedRate.serviceToken,
        rateId: selectedRateId,
        packageType,
        weight,
        dimensions,
        options: {
          createReturnLabel,
          emailLabelToRecipient: emailLabel,
          notifyEmails
        },
        createdBy: currentUser?.id,
        createdByEmail: currentUser?.email,
        createdByName: currentUser?.name
      };

      const shipment = await n8nService.createLabel(request);
      resetForm(); // Clear form on success
      onSuccess(shipment);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate label via N8N. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = (type: 'SENDER' | 'RECIPIENT') => {
    setAddAddressType(type);
    setIsEditAddressOpen(true);
    setEditingAddress(null);
  };

  const handleEditAddress = (type: 'SENDER' | 'RECIPIENT', address: Address) => {
    setAddAddressType(type);
    setEditingAddress(address);
    setIsEditAddressOpen(true);
  };

  const handleSaveNewAddress = async (address: Address, saveToBook: boolean) => {
    console.log("handleSaveNewAddress called:", { address, saveToBook });
    let finalAddress = address;

    if (editingAddress) {
      // Handle Update Case (This should ideally call an update API if saved permanently, but for now we update local state)
      console.log("Updating address:", address.id);
       if (address.type === 'RECIPIENT') {
        setLocalRecipients(prev => prev.map(r => r.id === address.id ? address : r));
       } else {
        setLocalSenders(prev => prev.map(s => s.id === address.id ? address : s));
       }
       // If permanent, you'd call an update function here too.
    } else {
        // Handle Creation Case
        if (saveToBook) {
        // Save permanently via App.tsx handlers
        console.log("Saving permanently via App.tsx handlers");
        if (address.type === 'RECIPIENT') {
            const saved = await onAddRecipient(address);
            if (saved) finalAddress = saved;
        } else {
            const saved = await onAddSender(address);
            if (saved) finalAddress = saved;
        }
        } else {
        // Add locally only (One-off)
        console.log("Adding locally only (One-off)");
        // Generate a temporary ID if it doesn't have one
        if (!finalAddress.id) {
            finalAddress = { ...finalAddress, id: `temp-${Date.now()}` };
        }
        
        if (finalAddress.type === 'RECIPIENT') {
            setLocalRecipients(prev => [finalAddress, ...prev]);
        } else {
            setLocalSenders(prev => [finalAddress, ...prev]);
        }
        }

        // Automatically select the new address
        if (finalAddress.type === 'RECIPIENT') {
            setRecipientId(finalAddress.id);
        } else {
            setSenderId(finalAddress.id);
        }
    }

    setIsEditAddressOpen(false);
    setEditingAddress(null);
  };

  const toggleNotifyEmail = (email: string) => {
    setNotifyEmails(prev => 
      prev.includes(email) 
        ? prev.filter(e => e !== email)
        : [...prev, email]
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
          
          {/* Header */}
          <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-lg">
                <Truck size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Generate FedEx Label</h2>
              </div>
            </div>
            <button onClick={() => {
              resetForm();
              onClose();
            }} className="text-slate-400 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
            {error && (
              <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                <AlertCircle size={20} />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            <form id="label-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left Column: Addresses */}
              <div className="space-y-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider border-b pb-2">Route</h3>
                
                <SearchableAddressSelect 
                    label="Sender (Origin)"
                    value={senderId}
                    onChange={setSenderId}
                    options={localSenders}
                    onAddNew={() => handleAddNew('SENDER')}
                    onEdit={(addr) => handleEditAddress('SENDER', addr)}
                    placeholder="Select sender..."
                />

                <SearchableAddressSelect 
                    label="Recipient (Destination)"
                    value={recipientId}
                    onChange={setRecipientId}
                    options={localRecipients}
                    onAddNew={() => handleAddNew('RECIPIENT')}
                    onEdit={(addr) => handleEditAddress('RECIPIENT', addr)}
                    placeholder="Select recipient..."
                />

                <AddressAutocomplete 
                  label="Reference" 
                  value={reference} 
                  onChange={(e) => setReference(e.target.value)}
                  onSelect={(data) => setReference(data.street1 || '')}
                  placeholder="Type to search address or enter reference..." 
                  required={true} 
                />
                
                <p className="text-xs text-indigo-600 mt-1">Required for billing and tracking.</p>
                
                {/* Rates Section */}
                <div className="mt-4 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 shadow-sm">
                  <label className="block text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Truck size={14} />
                    Select Shipping Rate
                  </label>
                  {loadingRates ? (
                    <div className="flex items-center gap-2 text-sm text-indigo-400 py-2">
                      <Loader2 className="animate-spin" size={16} />
                      <span>Fetching live rates...</span>
                    </div>
                  ) : rates.length > 0 ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="w-full flex items-center justify-between rounded-lg border-2 border-indigo-200 p-3 bg-white text-slate-700 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none hover:border-indigo-400 transition-all shadow-sm"
                      >
                        <span className="truncate">
                          {rates.find(r => r.rateId === selectedRateId)?.service} — {rates.find(r => r.rateId === selectedRateId)?.pricingType}
                        </span>
                        <ChevronDown size={20} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {isDropdownOpen && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-indigo-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                          {rates.map(rate => (
                            <button
                              key={rate.rateId}
                              type="button"
                              onClick={() => {
                                setSelectedRateId(rate.rateId);
                                setIsDropdownOpen(false);
                              }}
                              className="w-full flex items-center justify-between p-3 hover:bg-indigo-50 text-left text-sm"
                            >
                              <span>{rate.service} ({rate.estimatedDelivery})</span>
                              <span className="font-bold text-indigo-600">${rate.cost} - {rate.pricingType}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic py-2">
                      Select sender and recipient to view available rates.
                    </div>
                  )}
                  
                  {/* Selected Rate Details */}
                  {!loadingRates && rates.length > 0 && selectedRateId && (
                    <div className="mt-3 pt-3 border-t border-indigo-100 flex items-center justify-between animate-in slide-in-from-top-1 duration-300">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-100 rounded text-indigo-600">
                          <Truck size={16} />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter leading-none mb-0.5">ESTIMATED DELIVERY</div>
                          <div className="text-xs font-medium text-slate-500">
                            {rates.find(r => r.rateId === selectedRateId)?.estimatedDelivery || 'Calculating...'}
                          </div>
                        </div>
                      </div>
                      <div className="text-lg font-bold text-indigo-900">
                        ${rates.find(r => r.rateId === selectedRateId)?.cost || '0.00'}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Service & Options */}
              <div className="space-y-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider border-b pb-2">Service & Options</h3>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Service Type</label>
                  <div className="relative group">
                    <select 
                      value={serviceType}
                      onChange={(e) => setServiceType(e.target.value)}
                      className="w-full rounded-md border border-slate-300 p-2.5 bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none cursor-pointer hover:border-indigo-400 transition-colors shadow-sm"
                    >
                      {SERVICE_TYPES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-3 text-slate-500 pointer-events-none group-hover:text-indigo-600 transition-colors" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Package Type</label>
                  <div className="relative group">
                    <select 
                      value={packageType}
                      onChange={(e) => setPackageType(e.target.value)}
                      className="w-full rounded-md border border-slate-300 p-2.5 bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none cursor-pointer hover:border-indigo-400 transition-colors shadow-sm"
                    >
                      {PACKAGE_TYPES.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-3 text-slate-500 pointer-events-none group-hover:text-indigo-600 transition-colors" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Weight (lbs)</label>
                    <input 
                      type="number" 
                      min="1"
                      value={weight}
                      onChange={(e) => setWeight(Number(e.target.value))}
                      className="w-full rounded-md border border-slate-300 p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm"
                    />
                  </div>
                  <div>
                     <label className="block text-sm font-medium text-slate-700 mb-1">Dims (LxWxH)</label>
                     <div className="flex gap-1">
                        <input 
                          type="number"
                          value={dimensions.l}
                          onChange={(e) => setDimensions(prev => ({ ...prev, l: Number(e.target.value) }))}
                          disabled={packageType !== 'YOUR_PACKAGING'}
                          className={`w-full rounded-md border p-2 text-center text-sm shadow-sm transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${packageType === 'YOUR_PACKAGING' ? 'border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500' : 'border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed'}`}
                        />
                        <span className="flex items-center text-slate-400 text-xs">x</span>
                        <input 
                          type="number"
                          value={dimensions.w}
                          onChange={(e) => setDimensions(prev => ({ ...prev, w: Number(e.target.value) }))}
                          disabled={packageType !== 'YOUR_PACKAGING'}
                          className={`w-full rounded-md border p-2 text-center text-sm shadow-sm transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${packageType === 'YOUR_PACKAGING' ? 'border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500' : 'border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed'}`}
                        />
                        <span className="flex items-center text-slate-400 text-xs">x</span>
                        <input 
                          type="number"
                          value={dimensions.h}
                          onChange={(e) => setDimensions(prev => ({ ...prev, h: Number(e.target.value) }))}
                          disabled={packageType !== 'YOUR_PACKAGING'}
                          className={`w-full rounded-md border p-2 text-center text-sm shadow-sm transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${packageType === 'YOUR_PACKAGING' ? 'border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500' : 'border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed'}`}
                        />
                     </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors bg-white shadow-sm">
                    <input 
                      type="checkbox" 
                      checked={createReturnLabel}
                      onChange={(e) => setCreateReturnLabel(e.target.checked)}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" 
                    />
                    <div>
                      <span className="font-medium text-slate-800">Include Return Label</span>
                      <p className="text-xs text-slate-500">Generate a return label in the payload</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-not-allowed transition-colors bg-slate-50 shadow-sm opacity-60">
                    <input 
                      type="checkbox" 
                      checked={false}
                      disabled
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-not-allowed" 
                    />
                    <div>
                      <span className="font-medium text-slate-800">Email Label to Recipient</span>
                      <p className="text-xs text-slate-500">Coming soon</p>
                    </div>
                  </label>
                </div>

                <div className="relative" ref={internalNotifyRef}>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Internal Notifications</label>
                  <div 
                    className="w-full rounded-md border border-slate-300 p-2.5 bg-white text-slate-700 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 outline-none cursor-pointer hover:border-indigo-400 transition-colors shadow-sm flex flex-wrap gap-1 min-h-[42px] pr-8"
                    onClick={() => {
                        const newState = !isInternalNotifyOpen;
                        setIsInternalNotifyOpen(newState);
                        if (newState && internalNotifyRef.current) {
                            internalNotifyRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                    }}
                  >
                    {notifyEmails.length === 0 ? (
                      <span className="text-slate-400 text-sm">Select people to notify...</span>
                    ) : (
                      notifyEmails.map(val => {
                        const user = INTERNAL_USERS.find(u => u.value === val);
                        return (
                          <span key={val} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                            {user?.label || val}
                            <X 
                              size={12} 
                              className="cursor-pointer hover:text-indigo-900" 
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleNotifyEmail(val);
                              }}
                            />
                          </span>
                        );
                      })
                    )}
                    <ChevronDown size={16} className="absolute right-3 top-3 text-slate-500 pointer-events-none group-hover:text-indigo-600 transition-colors" />
                  </div>

                  {isInternalNotifyOpen && (
                    <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-md shadow-lg bottom-full mb-1 max-h-60 overflow-y-auto py-1">
                      {INTERNAL_USERS.map(user => (
                        <div 
                          key={user.value}
                          onClick={() => toggleNotifyEmail(user.value)}
                          className={`px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm flex items-center justify-between ${notifyEmails.includes(user.value) ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'}`}
                        >
                          {user.label}
                          {notifyEmails.includes(user.value) && (
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="px-5 py-2.5 rounded-lg text-slate-700 hover:bg-slate-200 font-medium transition-colors"
            >
              Cancel
            </button>
            <button 
              form="label-form"
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-lg shadow-indigo-200 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              Generate Label
            </button>
          </div>
        </div>
      </div>

      {/* Second Modal for Adding Address */}
      {isEditAddressOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh] border border-slate-200">
                <AddressForm 
                    initialData={editingAddress || undefined}
                    type={addAddressType}
                    onSave={handleSaveNewAddress}
                    onCancel={() => setIsEditAddressOpen(false)}
                    enableSaveOption={true}
                    customRecipientTypes={customRecipientTypes}
                    onUpdateSettings={handleUpdateSettings}
                />
            </div>
        </div>
      )}
    </>
  );
};
