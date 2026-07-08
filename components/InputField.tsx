
import React from 'react';

interface InputFieldProps {
  label: string;
  value: string | undefined;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  icon?: React.ReactNode;
  error?: boolean;
}

export const InputField: React.FC<InputFieldProps> = ({ 
  label, 
  value, 
  onChange, 
  onBlur,
  placeholder, 
  required = false, 
  type = "text",
  icon,
  error = false
}) => (
  <div className="w-full">
    <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative group">
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
          {icon}
        </div>
      )}
      <input 
        type={type}
        required={required}
        value={value || ''}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`w-full rounded-lg border ${error ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white'} ${icon ? 'pl-10' : 'px-4'} py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm transition-all shadow-sm hover:border-slate-400`}
      />
    </div>
  </div>
);
