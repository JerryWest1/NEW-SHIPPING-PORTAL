
import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { settingsService } from '../services/settingsService';

interface AddressAutocompleteProps {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelect: (addressData: any) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({ 
  label, 
  value, 
  onChange, 
  onSelect, 
  placeholder, 
  required = false,
  className = ""
}) => {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    settingsService.getSettings().then(settings => {
      setApiKey(settings.geoapifyApiKey || '');
    });
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (value && value.length > 3 && showSuggestions && apiKey) {
        setLoading(true);
        try {
          const response = await fetch(
            `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(value)}&apiKey=${apiKey}`
          );
          const data = await response.json();
          if (data.features) {
            setSuggestions(data.features);
          }
        } catch (error) {
          console.error("Geoapify Error:", error);
        } finally {
          setLoading(false);
        }
      } else if (!value) {
        setSuggestions([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [value, showSuggestions, apiKey]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e);
    setShowSuggestions(true);
  };

  const handleSelectSuggestion = (feature: any) => {
    const props = feature.properties;
    const addressData = {
      fullAddress: props.formatted || props.address_line1 + " " + props.address_line2,
      street1: props.address_line1 || `${props.housenumber || ''} ${props.street || ''}`.trim(),
      city: props.city || props.county || '',
      state: props.state_code || props.state || '',
      zip: props.postcode || '',
      country: props.country_code ? props.country_code.toUpperCase() : 'US'
    };
    onSelect(addressData);
    setShowSuggestions(false);
  };

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input 
          type="text"
          required={required}
          value={value || ''}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="w-full rounded-md border border-slate-300 p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm shadow-sm"
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3 top-2.5">
            <Loader2 className="animate-spin text-slate-400" size={16} />
          </div>
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
          {suggestions.map((feature: any, index: number) => (
            <li 
              key={index}
              onClick={() => handleSelectSuggestion(feature)}
              className="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm border-b border-slate-50 last:border-0"
            >
              <p className="font-medium text-slate-800">{feature.properties.address_line1}</p>
              <p className="text-xs text-slate-500">{feature.properties.address_line2}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
