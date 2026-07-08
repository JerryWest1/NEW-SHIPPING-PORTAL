import React, { useState, useEffect } from 'react';
import { ViewState, Address, Shipment } from './types';
import { AddressBook } from './components/AddressBook';
import { ShipmentHistory } from './components/ShipmentHistory';
import { CreateLabelModal } from './components/CreateLabelModal';
import { Settings } from './components/Settings';
import { settingsService } from './services/settingsService';
import { MOCK_RECIPIENTS, MOCK_SENDERS } from './components/constants';
import { db } from './lib/firebase';
import { collection, getDocs, addDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from './contexts/AuthContext';
import { UserManagement } from './components/UserManagement';
import { Profile } from './components/Profile';
import { AdminRoute } from './components/AdminRoute';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Settings as SettingsIcon, 
  LogOut, 
  Box, 
  Bell,
  Shield,
  User as UserIcon,
  ArrowRight,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface SidebarItemProps {
  id: ViewState;
  icon: any;
  label: string;
  active: boolean;
  onClick: (id: ViewState) => void;
}

const SidebarItem = ({ id, icon: Icon, label, active, onClick }: SidebarItemProps) => (
  <button
    onClick={() => onClick(id)}
    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors rounded-lg mb-1 ${
      active 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
        : 'text-slate-400 hover:text-white hover:bg-slate-800'
    }`}
  >
    <Icon size={20} />
    {label}
  </button>
);

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [view, setView] = useState<ViewState>('DASHBOARD');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<Address | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [shipmentSearchTerm, setShipmentSearchTerm] = useState('');
  const [recentActivitySortOrder, setRecentActivitySortOrder] = useState<'asc' | 'desc' | null>(null);
  const [customRecipientTypes, setCustomRecipientTypes] = useState<string[]>([]);
  const { user, logout, isLoading, isAuthenticated } = useAuth();

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

  useEffect(() => {
    console.log('App State:', { isAuthenticated, user, view, isLoading });
  }, [isAuthenticated, user, view, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const [recipients, setRecipients] = useState<Address[]>(() => {
    const saved = localStorage.getItem('fedex_recipients');
    return saved ? JSON.parse(saved) : MOCK_RECIPIENTS;
  });

  const [senders, setSenders] = useState<Address[]>(() => {
    const saved = localStorage.getItem('fedex_senders');
    return saved ? JSON.parse(saved) : MOCK_SENDERS;
  });

  useEffect(() => {
    const fetchShipments = async () => {
      const snapshot = await getDocs(collection(db, 'shipments'));
      const data: Shipment[] = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as Shipment));
      setShipments(data);
    };

    const unsubscribeAddresses = onSnapshot(collection(db, 'addresses'), (snapshot) => {
      const recipientsList: Address[] = [];
      const sendersList: Address[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data() as Address;
        const address = { id: doc.id, ...data };
        
        if (address.type === 'RECIPIENT') {
          recipientsList.push(address);
        } else {
          sendersList.push(address);
        }
      });
      
      setRecipients(recipientsList.sort((a, b) => a.name.localeCompare(b.name)));
      setSenders(sendersList.sort((a, b) => a.name.localeCompare(b.name)));
      setLoadingAddresses(false);
    }, (err) => {
      console.error('Error fetching addresses:', err);
      setLoadingAddresses(false);
    });

    fetchShipments();
    
    return () => {
      unsubscribeAddresses();
    };
  }, []);

  const totalShipments = shipments.length;
  const inTransit = shipments.filter(s => s.currentStatus?.includes('TRANSIT') && !s.currentStatus?.includes('PRE_TRANSIT')).length;
  const exceptions = shipments.filter(s => s.currentStatus?.includes('EXCEPTION')).length;
  const delivered = shipments.filter(s => s.currentStatus?.includes('DELIVERED')).length;

  const chartData = [
    { name: 'Transit', value: inTransit, color: '#4f46e5' },
    { name: 'Delivered', value: delivered, color: '#10b981' },
    { name: 'Exceptions', value: exceptions, color: '#ef4444' },
  ];

  useEffect(() => {
    localStorage.setItem('fedex_recipients', JSON.stringify(recipients));
  }, [recipients]);

  useEffect(() => {
    localStorage.setItem('fedex_senders', JSON.stringify(senders));
  }, [senders]);

  const handleGenerateLabel = (recipient: Address | null = null) => {
    setSelectedRecipient(recipient);
    setIsModalOpen(true);
  };

  const handleLabelSuccess = (shipment: Shipment) => {
    setNotification(`Label created successfully! Tracking: ${shipment.trackingNumber}`);
    setTimeout(() => setNotification(null), 5000);
    setView('SHIPMENTS');
  };

  const handleNavigateToContact = (name: string) => {
    setContactSearchTerm(name);
    setView('ADDRESS_BOOK');
  };

  const handleViewChange = (newView: ViewState) => {
    if (newView !== 'ADDRESS_BOOK') {
      setContactSearchTerm('');
    }
    if (newView !== 'SHIPMENTS') {
      setShipmentSearchTerm('');
    }
    setView(newView);
    setIsSidebarOpen(false); // Close sidebar on navigation
  };

  const handleAddRecipient = async (addr: Address): Promise<Address | null> => {
    try {
      const addressData = {
        type: addr.type || 'RECIPIENT',
        name: addr.name,
        company: addr.company || '',
        street1: addr.street1,
        street2: addr.street2 || '',
        city: addr.city,
        state: addr.state,
        zip: addr.zip,
        country: addr.country,
        phone: addr.phone || '',
        email: addr.email || '',
        recipientType: addr.recipientType || '',
      };
      const docRef = await addDoc(collection(db, 'addresses'), addressData);
      const newAddress = { ...addressData, id: docRef.id } as Address;
      setRecipients([newAddress, ...recipients].sort((a, b) => a.name.localeCompare(b.name)));
      return newAddress;
    } catch (err) {
      console.error('Error saving recipient to Firebase:', err);
      setRecipients([addr, ...recipients]);
      return null;
    }
  };

  const handleAddSender = async (addr: Address): Promise<Address | null> => {
    try {
      const addressData = {
        type: addr.type || 'SENDER',
        name: addr.name,
        company: addr.company || '',
        street1: addr.street1,
        street2: addr.street2 || '',
        city: addr.city,
        state: addr.state,
        zip: addr.zip,
        country: addr.country,
        phone: addr.phone || '',
        email: addr.email || '',
        recipientType: addr.recipientType || '',
      };
      const docRef = await addDoc(collection(db, 'addresses'), addressData);
      const newAddress = { ...addressData, id: docRef.id } as Address;
      setSenders([newAddress, ...senders].sort((a, b) => a.name.localeCompare(b.name)));
      return newAddress;
    } catch (err) {
      console.error('Error saving sender to Firebase:', err);
      setSenders([addr, ...senders]);
      return null;
    }
  };


  return (
    <div className="h-screen flex overflow-hidden bg-slate-50">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-10 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 w-64 bg-slate-900 text-white flex flex-col h-full flex-shrink-0 z-20 transition-transform duration-200 ease-in-out`}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg">
            <Box size={24} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">ShipMaster</h1>
            <p className="text-xs text-slate-400">FedEx Enterprise</p>
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 mt-2">Menu</p>
          <SidebarItem id="DASHBOARD" icon={LayoutDashboard} label="Dashboard" active={view === 'DASHBOARD'} onClick={handleViewChange} />
          <SidebarItem id="SHIPMENTS" icon={Package} label="Shipments" active={view === 'SHIPMENTS'} onClick={handleViewChange} />
          <SidebarItem id="ADDRESS_BOOK" icon={Users} label="Address Book" active={view === 'ADDRESS_BOOK'} onClick={handleViewChange} />
          <SidebarItem id="PROFILE" icon={UserIcon} label="My Profile" active={view === 'PROFILE'} onClick={handleViewChange} />
          
          {!isLoading && user && user.role === 'admin' && (
            <>
              <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 mt-6">Admin</p>
              <SidebarItem id="USER_MANAGEMENT" icon={Shield} label="User Management" active={view === 'USER_MANAGEMENT'} onClick={handleViewChange} />
              <SidebarItem id="SETTINGS" icon={SettingsIcon} label="Settings" active={view === 'SETTINGS'} onClick={handleViewChange} />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={() => handleViewChange('PROFILE')}
            className={`w-full flex items-center gap-3 px-4 py-3 mb-2 rounded-lg transition-colors text-left ${
              view === 'PROFILE' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-xs text-white flex-shrink-0">
              {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.name || user?.email}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{user?.role}</p>
            </div>
          </button>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 h-full flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-10 px-4 md:px-8 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Box size={20} />
            </button>
            <h2 className="text-lg font-semibold text-slate-700">
              {view === 'DASHBOARD' && 'Overview'}
              {view === 'SHIPMENTS' && 'Shipment Management'}
              {view === 'ADDRESS_BOOK' && 'Contact Management'}
              {view === 'SETTINGS' && 'System Settings'}
              {view === 'USER_MANAGEMENT' && 'User Management'}
              {view === 'PROFILE' && 'My Profile'}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => handleGenerateLabel(null)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all flex items-center gap-2"
            >
              <Box size={16} />
              <span className="hidden sm:inline">Quick Label</span>
            </button>
            <div className="relative">
              <Bell size={20} className="text-slate-400 hover:text-slate-600 cursor-pointer" />
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </div>
          </div>
        </header>

        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
          {notification && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center justify-between animate-fade-in-down shadow-sm">
              <div className="flex items-center gap-2">
                <Box size={20} />
                <span className="font-medium">{notification}</span>
              </div>
              <button onClick={() => setNotification(null)} className="text-green-600 hover:text-green-800 font-bold">×</button>
            </div>
          )}

          {view === 'DASHBOARD' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-sm text-slate-500 font-medium">Total Shipments</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{totalShipments}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-sm text-slate-500 font-medium">In Transit</p>
                  <p className="text-3xl font-bold text-indigo-600 mt-2">{inTransit}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-sm text-slate-500 font-medium">Delivered</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-2">{delivered}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-sm text-slate-500 font-medium">Exceptions</p>
                  <p className="text-3xl font-bold text-red-600 mt-2">{exceptions}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-800 mb-6">Shipment Status Overview</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-slate-800">Recent Activity</h3>
                    <button 
                      onClick={() => setRecentActivitySortOrder(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc')}
                      className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                    >
                      Sort by Status {recentActivitySortOrder === 'asc' ? <ArrowUp size={16} /> : recentActivitySortOrder === 'desc' ? <ArrowDown size={16} /> : null}
                    </button>
                  </div>
                  <div className="space-y-4">
                    {(() => {
                      let sorted = [...shipments].sort((a, b) => 
                        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                      );
                      
                      if (recentActivitySortOrder) {
                        const statusOrder: { [key: string]: number } = {
                          'PRE_TRANSIT': 1,
                          'PICKED_UP': 2,
                          'IN_TRANSIT': 3,
                          'TRANSIT': 3,
                          'DELIVERED': 4,
                          'EXCEPTION': 5,
                          'RETURN': 6
                        };
                        sorted.sort((a, b) => {
                          const statusA = (a.currentStatus || '').toUpperCase();
                          const statusB = (b.currentStatus || '').toUpperCase();
                          const rankA = statusOrder[statusA] || 99;
                          const rankB = statusOrder[statusB] || 99;
                          return recentActivitySortOrder === 'asc' 
                            ? rankA - rankB 
                            : rankB - rankA;
                        });
                      }
                      return sorted.slice(0, 5).map(shipment => {
                        const recipientFromBook = recipients.find(r => r.id === shipment.recipient?.id) || 
                                                  recipients.find(r => r.name === (shipment.recipientName || shipment.recipient?.name));
                        const companyName = recipientFromBook?.company || shipment.recipient?.company;
                        
                        return (
                        <div key={shipment.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {shipment.recipientName || shipment.recipient?.name || 'Unknown Recipient'}
                            </p>
                            {companyName && (
                              <p className="text-xs text-slate-500">{companyName}</p>
                            )}
                            <p className="text-xs text-slate-500">{shipment.currentStatus}</p>
                          </div>
                          <button 
                            onClick={() => {
                              setShipmentSearchTerm(shipment.trackingNumber);
                              handleViewChange('SHIPMENTS');
                            }}
                            className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                          >
                            <ArrowRight size={16} className="text-slate-400" />
                          </button>
                        </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'SHIPMENTS' && <ShipmentHistory onNavigateToContact={handleNavigateToContact} initialSearchTerm={shipmentSearchTerm} />}
          
          {view === 'ADDRESS_BOOK' && (
            <AddressBook 
              onGenerateLabel={handleGenerateLabel} 
              recipients={recipients}
              senders={senders}
              onUpdateRecipients={setRecipients}
              onUpdateSenders={setSenders}
              loading={loadingAddresses}
              initialSearchTerm={contactSearchTerm}
              customRecipientTypes={customRecipientTypes}
              onUpdateSettings={handleUpdateSettings}
            />
          )}

          {view === 'SETTINGS' && (
            <AdminRoute>
              <Settings />
            </AdminRoute>
          )}

          {view === 'USER_MANAGEMENT' && (
            <AdminRoute>
              <UserManagement />
            </AdminRoute>
          )}

          {view === 'PROFILE' && <Profile />}
        </div>
      </main>

      <CreateLabelModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        preSelectedRecipient={selectedRecipient}
        onSuccess={handleLabelSuccess}
        recipients={recipients}
        senders={senders}
        onAddRecipient={handleAddRecipient}
        onAddSender={handleAddSender}
      />
    </div>
  );
};

export default App;