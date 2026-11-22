import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, User,
  Trash2, History, Archive,
  Filter, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEmployeeClients } from '../../hooks/admin/useAdminClients';
import { useAuth } from '../../contexts/AuthContext';
import ClientActionRequestModal from '../../components/clients/ClientActionRequestModal';
import CreateClientSlideOver from '../../components/shared/clients/CreateClientSlideOver';
import CreateJobModal from '../../components/jobs/CreateJobModal';
import Skeleton from '../../components/ui/Skeleton';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ClientsHub = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: clients, isLoading } = useEmployeeClients(profile?.id);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'mine' | 'assigned' | 'saudi'>('all');

  // Modals state
  const [requestModal, setRequestModal] = useState<{
    isOpen: boolean;
    mode: 'DELETE' | 'ARCHIVE';
    client: { id: string; full_name: string } | null;
  }>({
    isOpen: false,
    mode: 'ARCHIVE',
    client: null
  });

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{ id: string, full_name: string } | null>(null);

  const filteredClients = clients?.filter(c => {
    const matchesSearch = c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.client_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.phone?.includes(searchQuery);
    
    if (!matchesSearch) return false;
    if (filterType === 'mine' && c.created_by !== profile?.id) return false;
    if (filterType === 'assigned' && c.created_by === profile?.id) return false;
    if (filterType === 'saudi') {
      const isSaudi = (c as any).is_saudi_client || c.nationality === 'Saudi Arabia' || (c as any).b2b_partner_id;
      if (!isSaudi) return false;
    }
    return true;
  });

  const handleActionRequest = (client: any, mode: 'DELETE' | 'ARCHIVE') => {
    setRequestModal({
      isOpen: true,
      mode,
      client
    });
  };

  const handleLaunchJob = (client: any) => {
    setSelectedClient(client);
    setIsCreateJobOpen(true);
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-syne font-bold text-foreground">Client Management Hub</h1>
          <p className="text-sm text-muted-foreground uppercase font-bold tracking-[0.2em] mt-1">Client Lifetime Value & Operations</p>
        </div>
        <button
          onClick={() => setIsRegisterOpen(true)}
          className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-2xl flex items-center gap-2 hover:shadow-[0_0_30px_rgba(212,175,55,0.2)] transition-all active:scale-95"
        >
          <Plus size={20} /> Register New Client
        </button>
      </div>

      <CreateClientSlideOver
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
      />

      {/* Toolbar */}
      <div className="bg-card border border-border rounded-3xl shadow-2xl p-2 flex flex-col lg:flex-row gap-4 items-center">
        <div className="flex-1 w-full relative">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by Name, CR, or Phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background/50 border-none outline-none pl-12 pr-4 py-4 text-foreground placeholder:text-muted-foreground text-base rounded-2xl"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-muted/50 border border-border rounded-2xl w-full lg:w-auto overflow-x-auto no-scrollbar">
          {(['all', 'mine', 'assigned', 'saudi'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`relative px-4 py-2.5 text-[10px] sm:text-xs font-bold uppercase tracking-widest rounded-xl transition-colors whitespace-nowrap flex-1 lg:flex-none ${filterType === f ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {f === 'mine' ? 'My Registrations' : f === 'assigned' ? 'Assigned to Me' : f === 'saudi' ? '🇸🇦 Saudi & B2B' : 'All Clients'}
              {filterType === f && (
                <motion.div layoutId="clientFilter" className="absolute inset-0 bg-card rounded-xl shadow-sm border border-border -z-10" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Client Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-[280px] bg-white/5 animate-pulse rounded-[40px] border border-white/5" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {filteredClients?.map((client, idx) => (
              <motion.div
                key={client.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4, delay: idx * 0.03 }}
                // Add a cursor-pointer if the whole card is clickable, or leave it as is
                className="group relative bg-card/60 backdrop-blur-xl border border-border rounded-[40px] p-8 hover:border-primary/40 transition-all duration-500 shadow-2xl hover:shadow-primary/5 overflow-hidden"
              >
                {/* Subtle Gradient Glow Background */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 blur-[80px] group-hover:bg-primary/10 transition-colors duration-500 rounded-full" />
 
                {/* Header Section */}
                <div className="flex items-start justify-between mb-8 relative z-10">
                  <div className="flex items-center gap-5">
                    <div className="relative">
                      <div className="bg-muted ring-1 ring-border rounded-2xl flex items-center justify-center overflow-hidden w-16 h-16 shadow-inner">
                        {client.avatar_url ? (
                          <img src={client.avatar_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <User className="text-muted-foreground" size={32} />
                        )}
                      </div>
                      {/* Active Indicator */}
                      <div className={cn(
                        "absolute -top-1 -right-1 h-4 w-4 rounded-full border-4 border-card z-10",
                        client.is_active ? "bg-emerald-400" : "bg-red-400"
                      )} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl font-bold text-foreground truncate font-syne tracking-tight">{client.full_name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-muted text-[9px] text-muted-foreground font-mono tracking-tighter border border-border">
                          {client.client_code || 'ID-PENDING'}
                        </span>
                        {client.created_by === profile?.id ? (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-widest border border-primary/20">
                            My Client
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 text-[9px] font-bold uppercase tracking-widest border border-amber-500/20">
                            Assigned
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
 
                  {/* FIXED HISTORY BUTTON */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation(); // Prevents the card from triggering other clicks
                      navigate(`/employee/clients/${client.id}/history`);
                    }}
                    className="p-3 rounded-2xl bg-muted text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20 cursor-pointer relative z-20"
                    title="View History"
                  >
                    <History size={20} />
                  </button>
                </div>
 
                {/* Info Section */}
                <div className="grid grid-cols-2 gap-4 mb-8 relative z-10">
                  <div className="bg-muted rounded-2xl p-3 border border-border">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Phone</p>
                    <p className="text-sm font-mono text-foreground">{client.phone || '—'}</p>
                  </div>
                  <div className="bg-muted rounded-2xl p-3 border border-border">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Active Jobs</p>
                    <p className="text-sm font-mono text-primary font-bold">{client.active_jobs || 0}</p>
                  </div>
                </div>
 
                {/* Actions Section */}
                <div className="space-y-3 relative z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLaunchJob(client);
                    }}
                    className="w-full py-4 rounded-2xl bg-primary text-primary-foreground text-[11px] font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-primary/20 group/btn"
                  >
                    Start New Job
                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </button>
 
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleActionRequest(client, 'ARCHIVE');
                      }}
                      className="py-3 rounded-xl bg-muted hover:bg-amber-500/10 text-muted-foreground hover:text-amber-400 text-[10px] font-bold uppercase tracking-widest border border-border hover:border-amber-500/30 transition-all flex items-center justify-center gap-2"
                    >
                      Archive <Archive size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleActionRequest(client, 'DELETE');
                      }}
                      className="py-3 rounded-xl bg-muted hover:bg-red-500/10 text-muted-foreground hover:text-red-400 text-[10px] font-bold uppercase tracking-widest border border-border hover:border-red-500/30 transition-all flex items-center justify-center gap-2"
                    >
                      Delete <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modals */}
      <ClientActionRequestModal
        isOpen={requestModal.isOpen}
        onClose={() => setRequestModal({ ...requestModal, isOpen: false })}
        client={requestModal.client}
        mode={requestModal.mode}
      />

      <CreateJobModal
        isOpen={isCreateJobOpen}
        onClose={() => {
          setIsCreateJobOpen(false);
          setSelectedClient(null);
        }}
        preSelectedClientId={selectedClient?.id}
      />
    </div>
  );
};

export default ClientsHub;
