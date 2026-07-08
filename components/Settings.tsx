
import React, { useState, useEffect, useRef } from 'react';
import { Save, Settings as SettingsIcon, Shield, Globe, Key, Activity, CheckCircle, AlertTriangle, Info, Mail, Upload, Download, FileText, Loader2 } from 'lucide-react';
import { settingsService } from '../services/settingsService';
import { n8nService } from '../services/n8nService';
import { AppSettings, Address } from '../types';
import { useAuth } from '../contexts/AuthContext';
import Papa from 'papaparse';
import { db } from '../lib/firebase';
import { collection, writeBatch, doc } from 'firebase/firestore';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>({
    n8nWebhookUrl: '',
    resendLabelWebhookUrl: '',
    deleteShipmentWebhookUrl: '',
    inviteUserWebhookUrl: '',
    getRatesWebhookUrl: '',
    geoapifyApiKey: ''
  });
  const [createTest, setCreateTest] = useState({ status: 'IDLE', message: '' });
  const [deleteTest, setDeleteTest] = useState({ status: 'IDLE', message: '' });
  const [saved, setSaved] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    status: 'IDLE' | 'PARSING' | 'IMPORTING' | 'SUCCESS' | 'ERROR';
    message: string;
    count?: number;
  }>({ status: 'IDLE', message: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuth();

  useEffect(() => {
    const loadSettings = async () => {
      const loaded = await settingsService.getSettings();
      setSettings(loaded);
    };
    loadSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (user?.role !== 'admin') return;
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
    setSaved(false);
    setCreateTest({ status: 'IDLE', message: '' });
    setDeleteTest({ status: 'IDLE', message: '' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role !== 'admin') return;
    await settingsService.saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTestConnection = async (url: string, action: string, setTest: React.Dispatch<React.SetStateAction<{status: string, message: string}>>) => {
    if (!url || user?.role !== 'admin') return;
    
    setTest({ status: 'TESTING', message: '' });
    
    try {
        const result = await n8nService.testConnection(url, action);
        setTest({ status: 'SUCCESS', message: result });
    } catch (err: any) {
        setTest({ status: 'ERROR', message: err.message || "Unknown error occurred" });
    }
  };

  const isTestUrl = (url: string) => url.includes('webhook-test');

  const handleDownloadTemplate = () => {
    const csvContent = "name,company,street1,street2,city,state,zip,country,phone,email\nJohn Doe,Acme Corp,123 Main St,Suite 100,New York,NY,10001,US,555-0123,john@example.com";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "recipient_import_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus({ status: 'PARSING', message: 'Parsing CSV file...' });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as any[];
        if (data.length === 0) {
          setImportStatus({ status: 'ERROR', message: 'The CSV file is empty.' });
          return;
        }

        // Basic validation
        const requiredFields = ['name', 'street1', 'city', 'state', 'zip', 'country'];
        const firstRow = data[0];
        const missingFields = requiredFields.filter(field => !(field in firstRow));

        if (missingFields.length > 0) {
          setImportStatus({ 
            status: 'ERROR', 
            message: `Missing required columns: ${missingFields.join(', ')}` 
          });
          return;
        }

        try {
          setImportStatus({ status: 'IMPORTING', message: `Importing ${data.length} contacts...`, count: data.length });
          
          const batch = writeBatch(db);
          const addressCollection = collection(db, 'addresses');

          data.forEach((row) => {
            const newDocRef = doc(addressCollection);
            batch.set(newDocRef, {
              name: row.name || '',
              company: row.company || '',
              street1: row.street1 || '',
              street2: row.street2 || '',
              city: row.city || '',
              state: row.state || '',
              zip: row.zip || '',
              country: row.country || 'US',
              phone: row.phone || '',
              email: row.email || '',
              type: 'RECIPIENT',
              recipientType: row.recipientType || 'RESIDENTIAL',
              createdAt: new Date().toISOString()
            });
          });

          await batch.commit();
          setImportStatus({ 
            status: 'SUCCESS', 
            message: `Successfully imported ${data.length} recipients.`,
            count: data.length
          });
          
          if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err: any) {
          console.error('Import error:', err);
          setImportStatus({ status: 'ERROR', message: `Failed to import: ${err.message}` });
        }
      },
      error: (error) => {
        setImportStatus({ status: 'ERROR', message: `CSV Parsing error: ${error.message}` });
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <SettingsIcon size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">System Configuration</h2>
              <p className="text-slate-500 text-sm">Manage API keys and external connections securely.</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <form onSubmit={handleSave} className="space-y-8">
            
            {/* N8N Configuration */}
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="mt-1">
                   <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                     <Globe size={20} />
                   </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-slate-900">N8N Webhook Configuration</h3>
                  <p className="text-sm text-slate-500 mb-4">Enter the webhook URLs from your N8N workflows.</p>
                  
                  {/* Create Label Webhook */}
                  <div className="relative mb-6">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Create Label Webhook URL
                    </label>
                    <div className="flex gap-2">
                        <input 
                          type="url" 
                          name="n8nWebhookUrl"
                          value={settings.n8nWebhookUrl}
                          onChange={handleChange}
                          disabled={user?.role !== 'admin'}
                          placeholder="https://n8n.yourdomain.com/webhook/create-label"
                          className="flex-1 rounded-lg border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
                        />
                        <button
                           type="button"
                           onClick={() => handleTestConnection(settings.n8nWebhookUrl, 'CREATE_LABEL', setCreateTest)}
                           disabled={!settings.n8nWebhookUrl || createTest.status === 'TESTING' || user?.role !== 'admin'}
                           className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-medium hover:bg-indigo-100 transition-colors border border-indigo-200 flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                        >
                           {createTest.status === 'TESTING' ? <Activity className="animate-spin" size={18} /> : <Activity size={18} />}
                           Test
                        </button>
                    </div>

                    {/* Helper Text for Test vs Prod */}
                    <div className="mt-2 flex items-start gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded">
                        <Info size={14} className="mt-0.5 text-indigo-500 shrink-0" />
                        <div>
                           {isTestUrl(settings.n8nWebhookUrl) ? (
                               <span className="text-indigo-700 font-medium">
                                   Test URL Detected: Ensure you click "Execute Workflow" in N8N <u>before</u> triggering the app.
                               </span>
                           ) : (
                               <span>
                                   <strong>Production URL:</strong> Ensure your N8N workflow is set to <strong>Active</strong>.
                               </span>
                           )}
                        </div>
                    </div>
                    
                    {/* Status Feedback */}
                    {createTest.status === 'SUCCESS' && (
                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-800">
                            <CheckCircle size={16} className="text-green-600" />
                            {createTest.message}
                        </div>
                    )}
                    {createTest.status === 'ERROR' && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                            <div className="flex items-center gap-2 font-semibold mb-1">
                                <AlertTriangle size={16} className="text-red-600" />
                                Connection Failed
                            </div>
                            {createTest.message}
                        </div>
                    )}
                  </div>

                  {/* Resend Label Webhook */}
                  <div className="relative mb-6">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Resend Label Webhook URL
                    </label>
                    <div className="flex gap-2">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 top-7">
                           <Mail size={16} />
                        </div>
                        <input 
                          type="url" 
                          name="resendLabelWebhookUrl"
                          value={settings.resendLabelWebhookUrl}
                          onChange={handleChange}
                          disabled={user?.role !== 'admin'}
                          placeholder="https://n8n.yourdomain.com/webhook/resend-label"
                          className="flex-1 rounded-lg border border-slate-300 p-3 pl-10 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
                        />
                    </div>
                     <p className="text-xs text-slate-400 mt-2">
                      Webhook to trigger when clicking 'Resend' in history.
                    </p>
                  </div>

                  {/* Invite User Webhook */}
                  <div className="relative mb-6">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Invite User Webhook URL
                    </label>
                    <div className="flex gap-2">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 top-7">
                           <Mail size={16} />
                        </div>
                        <input 
                          type="url" 
                          name="inviteUserWebhookUrl"
                          value={settings.inviteUserWebhookUrl}
                          onChange={handleChange}
                          disabled={user?.role !== 'admin'}
                          placeholder="https://n8n.yourdomain.com/webhook/invite-user"
                          className="flex-1 rounded-lg border border-slate-300 p-3 pl-10 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
                        />
                    </div>
                     <p className="text-xs text-slate-400 mt-2">
                      Webhook to trigger when inviting a new team member.
                    </p>
                  </div>

                  {/* Get Rates Webhook */}
                  <div className="relative mb-6">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Get Rates Webhook URL
                    </label>
                    <div className="flex gap-2">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 top-7">
                           <Activity size={16} />
                        </div>
                        <input 
                          type="url" 
                          name="getRatesWebhookUrl"
                          value={settings.getRatesWebhookUrl}
                          onChange={handleChange}
                          disabled={user?.role !== 'admin'}
                          placeholder="https://n8n.yourdomain.com/webhook/get-rates"
                          className="flex-1 rounded-lg border border-slate-300 p-3 pl-10 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
                        />
                    </div>
                     <p className="text-xs text-slate-400 mt-2">
                      Webhook to trigger when fetching shipping rates.
                    </p>
                  </div>

                  {/* Delete Shipment Webhook */}
                  <div className="relative">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Delete Shipment Webhook URL
                    </label>
                    <div className="flex gap-2">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 top-7">
                           <Mail size={16} />
                        </div>
                        <input 
                          type="url" 
                          name="deleteShipmentWebhookUrl"
                          value={settings.deleteShipmentWebhookUrl}
                          onChange={handleChange}
                          disabled={user?.role !== 'admin'}
                          placeholder="https://n8n.yourdomain.com/webhook/delete-shipment"
                          className="flex-1 rounded-lg border border-slate-300 p-3 pl-10 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
                        />
                        <button
                           type="button"
                           onClick={() => handleTestConnection(settings.deleteShipmentWebhookUrl, 'DELETE_SHIPMENT', setDeleteTest)}
                           disabled={!settings.deleteShipmentWebhookUrl || deleteTest.status === 'TESTING' || user?.role !== 'admin'}
                           className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-medium hover:bg-indigo-100 transition-colors border border-indigo-200 flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                        >
                           {deleteTest.status === 'TESTING' ? <Activity className="animate-spin" size={18} /> : <Activity size={18} />}
                           Test
                        </button>
                    </div>
                     <p className="text-xs text-slate-400 mt-2">
                      Webhook to trigger when deleting a shipment.
                    </p>
                    
                    {/* Status Feedback */}
                    {deleteTest.status === 'SUCCESS' && (
                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-800">
                            <CheckCircle size={16} className="text-green-600" />
                            {deleteTest.message}
                        </div>
                    )}
                    {deleteTest.status === 'ERROR' && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                            <div className="flex items-center gap-2 font-semibold mb-1">
                                <AlertTriangle size={16} className="text-red-600" />
                                Connection Failed
                            </div>
                            {deleteTest.message}
                        </div>
                    )}
                  </div>

                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* API Keys */}
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="mt-1">
                   <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                     <Key size={20} />
                   </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-slate-900">Third-Party API Keys</h3>
                  <p className="text-sm text-slate-500 mb-4">Configure keys for address validation and autocomplete.</p>
                  
                  <div className="relative">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Geoapify API Key
                    </label>
                    <input 
                      type="text" 
                      name="geoapifyApiKey"
                      value={settings.geoapifyApiKey}
                      onChange={handleChange}
                      disabled={user?.role !== 'admin'}
                      placeholder="Enter your Geoapify API Key"
                      className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono disabled:bg-slate-50 disabled:text-slate-500"
                    />
                    <p className="text-xs text-slate-400 mt-2">
                       Used for address autocomplete suggestions.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-end gap-4">
               {saved && (
                 <span className="text-sm text-green-600 font-medium animate-pulse flex items-center gap-1">
                   <Save size={16} /> Saved Successfully
                 </span>
               )}
               <button 
                type="submit"
                disabled={user?.role !== 'admin'}
                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-lg font-medium shadow-lg shadow-slate-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 <Save size={18} />
                 Save Settings
               </button>
            </div>

          </form>
        </div>
      </div>

      {/* Bulk Import Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Upload size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Bulk Recipient Import</h2>
              <p className="text-slate-500 text-sm">Import multiple contacts at once via CSV upload.</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-slate-900 flex items-center gap-2">
                <Info size={20} className="text-indigo-500" />
                Instructions
              </h3>
              <ul className="space-y-2 text-sm text-slate-600 list-disc pl-5">
                <li>Download the template to see the required column format.</li>
                <li>Required columns: <code className="bg-slate-100 px-1 rounded text-indigo-600">name</code>, <code className="bg-slate-100 px-1 rounded text-indigo-600">street1</code>, <code className="bg-slate-100 px-1 rounded text-indigo-600">city</code>, <code className="bg-slate-100 px-1 rounded text-indigo-600">state</code>, <code className="bg-slate-100 px-1 rounded text-indigo-600">zip</code>, <code className="bg-slate-100 px-1 rounded text-indigo-600">country</code>.</li>
                <li>Optional columns: <code className="bg-slate-100 px-1 rounded">company</code>, <code className="bg-slate-100 px-1 rounded">street2</code>, <code className="bg-slate-100 px-1 rounded">phone</code>, <code className="bg-slate-100 px-1 rounded">email</code>.</li>
                <li>The system will automatically set the type to <strong>RECIPIENT</strong>.</li>
              </ul>
              
              <button 
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors"
              >
                <Download size={16} />
                Download CSV Template
              </button>
            </div>

            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-8 bg-slate-50 hover:bg-slate-100 transition-all">
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv"
                className="hidden"
              />
              
              {importStatus.status === 'IDLE' && (
                <div className="text-center space-y-4">
                  <div className="p-4 bg-white rounded-full shadow-sm inline-block">
                    <FileText size={40} className="text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Click to upload CSV</p>
                    <p className="text-xs text-slate-500 mt-1">or drag and drop file here</p>
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all shadow-sm"
                  >
                    Select File
                  </button>
                </div>
              )}

              {(importStatus.status === 'PARSING' || importStatus.status === 'IMPORTING') && (
                <div className="text-center space-y-4">
                  <Loader2 size={40} className="text-indigo-600 animate-spin mx-auto" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{importStatus.message}</p>
                    <p className="text-xs text-slate-500 mt-1">Please do not close this window.</p>
                  </div>
                </div>
              )}

              {importStatus.status === 'SUCCESS' && (
                <div className="text-center space-y-4">
                  <div className="p-4 bg-green-100 rounded-full inline-block">
                    <CheckCircle size={40} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Import Complete!</p>
                    <p className="text-xs text-green-600 mt-1">{importStatus.message}</p>
                  </div>
                  <button 
                    onClick={() => setImportStatus({ status: 'IDLE', message: '' })}
                    className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                  >
                    Import another file
                  </button>
                </div>
              )}

              {importStatus.status === 'ERROR' && (
                <div className="text-center space-y-4">
                  <div className="p-4 bg-red-100 rounded-full inline-block">
                    <AlertTriangle size={40} className="text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Import Failed</p>
                    <p className="text-xs text-red-600 mt-1">{importStatus.message}</p>
                  </div>
                  <button 
                    onClick={() => setImportStatus({ status: 'IDLE', message: '' })}
                    className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
