import React from 'react';
import { User, Mail, Phone, ChevronRight, LayoutGrid, List, Zap, Edit2, Trash2, X } from 'lucide-react';
import { useDeleteClient } from '../../hooks/admin/useAdminClients';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

export interface ClientProfile {
  id: string;
  full_name: string;
  company_name?: string | null;
  email?: string;
  phone?: string;
  avatar_url?: string;
  client_code?: string;
  created_at?: string;
  created_by?: string;
}

interface ClientListViewProps {
  clients: ClientProfile[];
  jobs: any[]; // Used to calculate project stats
  onClientSelect: (clientId: string) => void;
  onViewToggle: (mode: 'split' | 'list') => void;
  currentMode: 'split' | 'list';
  clientTypeFilter?: 'standard' | 'walk-in';
  onClientTypeChange?: (type: 'standard' | 'walk-in') => void;
  onNewClient?: () => void;
  onEditClient?: (client: ClientProfile) => void;
  isLoading?: boolean;
}

const DeleteClientModal = ({ 
  isOpen, 
  onClose, 
  client, 
  onConfirm,
  isDeleting = false
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  client: ClientProfile | null;
  onConfirm: (id: string) => void;
  isDeleting?: boolean;
}) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const [confirmText, setConfirmText] = React.useState('');
  
  if (!isOpen || !client) return null;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border w-full max-w-md rounded-3xl p-6 shadow-2xl relative">
        <button disabled={isDeleting} onClick={onClose} className="absolute right-4 top-4 p-2 text-muted-foreground hover:bg-muted rounded-full disabled:opacity-50">
          <X size={20} />
        </button>
        
        <div className="w-12 h-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-4 border border-destructive/20">
          <Trash2 size={24} />
        </div>
        
        <h3 className="text-xl font-bold font-syne text-foreground mb-2">
          {isRtl ? 'حذف العميل' : 'Delete Client'}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {isRtl ? `هل أنت متأكد من رغبتك في حذف ${client.full_name}؟ لا يمكن التراجع عن هذا الإجراء.` : `Are you sure you want to delete ${client.full_name}? This action cannot be undone.`}
        </p>
        
        <div className="bg-muted/50 p-4 rounded-xl border border-border mb-6">
          <p className="text-xs text-muted-foreground mb-2">
            {isRtl ? `يرجى كتابة ${client.full_name} للتأكيد.` : `Please type ${client.full_name} to confirm.`}
          </p>
          <input
            type="text"
            disabled={isDeleting}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm focus:border-destructive outline-none transition-colors disabled:opacity-50"
            placeholder={client.full_name}
          />
        </div>
        
        <div className="flex justify-end gap-3">
          <button 
            disabled={isDeleting}
            onClick={onClose} 
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            {isRtl ? 'إلغاء' : 'Cancel'}
          </button>
          <button 
            disabled={confirmText !== client.full_name || isDeleting}
            onClick={() => onConfirm(client.id)}
            className="px-5 py-2.5 rounded-xl font-bold text-sm bg-destructive text-destructive-foreground hover:brightness-110 disabled:opacity-50 transition-all shadow-lg shadow-destructive/20 flex items-center gap-2"
          >
            {isDeleting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            <span>{isDeleting ? (isRtl ? 'جارٍ الحذف...' : 'Deleting...') : (isRtl ? 'حذف العميل' : 'Delete Client')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const ClientListView: React.FC<ClientListViewProps> = ({ 
  clients, 
  jobs, 
  onClientSelect, 
  onViewToggle, 
  currentMode, 
  clientTypeFilter = 'standard', 
  onClientTypeChange, 
  onNewClient, 
  onEditClient,
  isLoading = false 
}) => {
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
  const [clientToDelete, setClientToDelete] = React.useState<ClientProfile | null>(null);
  const [filterType, setFilterType] = React.useState<'all' | 'mine' | 'assigned'>('all');
  const { mutate: deleteClient, isPending: isDeletingClient } = useDeleteClient();
  const { profile } = useAuth();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  
  const handleDeleteConfirm = (id: string) => {
    deleteClient(id, {
      onSuccess: () => {
        setDeleteModalOpen(false);
        setClientToDelete(null);
      },
      onError: () => {
        setDeleteModalOpen(false);
        setClientToDelete(null);
      }
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-background no-scrollbar" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-syne font-bold text-foreground">{isRtl ? 'دليل العملاء' : 'Client Directory'}</h2>
          <div className="flex items-center gap-4">
            <div className="flex bg-muted/50 p-1 rounded-xl border border-border">
              <button 
                onClick={() => onViewToggle('split')}
                className={`p-1.5 rounded-lg transition-all ${currentMode === 'split' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <LayoutGrid size={16} />
              </button>
              <button 
                onClick={() => onViewToggle('list')}
                className={`p-1.5 rounded-lg transition-all ${currentMode === 'list' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <List size={16} />
              </button>
            </div>
            
            {onNewClient && (
              <button
                onClick={onNewClient}
                className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl flex items-center gap-2 hover:shadow-[0_0_20px_rgba(212,175,55,0.2)] transition-all active:scale-95 text-sm"
              >
                <User size={16} /> {isRtl ? 'إضافة عميل' : 'Add Client'}
              </button>
            )}
          </div>
        </div>

        {onClientTypeChange && (
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="flex bg-card p-1 rounded-2xl border border-border w-full max-w-md">
              <button 
                onClick={() => onClientTypeChange('standard')}
                className={`flex-1 flex justify-center items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${clientTypeFilter === 'standard' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <User size={16} /> {isRtl ? 'العملاء الاعتياديين' : 'Standard Clients'}
              </button>
              <button 
                onClick={() => onClientTypeChange('walk-in')}
                className={`flex-1 flex justify-center items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${clientTypeFilter === 'walk-in' ? 'bg-amber-500 text-amber-950 shadow-lg shadow-amber-500/20' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Zap size={16} /> {isRtl ? 'حضور مباشر' : 'Walk-in'}
              </button>
            </div>
            
            {clientTypeFilter === 'standard' && (
              <div className="flex items-center gap-1 p-1 bg-muted/50 border border-border rounded-2xl w-full max-w-md overflow-x-auto no-scrollbar">
                {(['all', 'mine'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilterType(f)}
                    className={`relative flex-1 px-4 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest rounded-xl transition-colors whitespace-nowrap ${filterType === f ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {f === 'mine' ? (isRtl ? 'تسجيلاتي' : 'My Registrations') : (isRtl ? 'جميع العملاء' : 'All Clients')}
                    {filterType === f && (
                      <motion.div layoutId="clientListFilter" className="absolute inset-0 bg-card rounded-xl shadow-sm border border-border -z-10" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        {isLoading ? (
          currentMode === 'split' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-card border border-border rounded-3xl p-6 shadow-sm animate-pulse space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-muted" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted/60 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-px bg-border/40" />
                  <div className="space-y-2">
                    <div className="h-3 bg-muted/60 rounded w-2/3" />
                    <div className="h-3 bg-muted/60 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-3xl overflow-hidden p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-12 bg-muted/40 rounded-xl animate-pulse" />
              ))}
            </div>
          )
        ) : currentMode === 'split' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(() => {
              const filtered = clients.filter(c => {
                const isWalkIn = c.email?.startsWith('walkin_') || c.email?.endsWith('@osbic.local') || c.id?.startsWith('walkin-');
                
                if (clientTypeFilter === 'standard' && isWalkIn) return false;
                if (clientTypeFilter === 'walk-in' && !isWalkIn) return false;

                if (clientTypeFilter === 'standard') {
                  if (filterType === 'mine' && c.created_by !== profile?.id) return false;
                  if (filterType === 'assigned' && c.created_by === profile?.id) return false;
                }
                return true;
              });

              if (filtered.length === 0) {
                return (
                  <div className="col-span-full text-center py-16 p-8 border border-dashed border-border rounded-3xl bg-card/40">
                    <p className="text-muted-foreground text-sm font-medium">
                      {isRtl ? 'لم يتم العثور على عملاء.' : 'No clients found.'}
                    </p>
                  </div>
                );
              }

              return filtered.map(client => {
                const clientJobs = jobs.filter(j => j.client_id === client.id);
                const activeJobs = clientJobs.filter(j => j.status === 'active' || j.status === 'in_progress');

                return (
                  <div
                    key={client.id}
                    onClick={() => onClientSelect(client.id)}
                    className="bg-card border border-border hover:border-primary/40 rounded-3xl p-6 shadow-md transition-all cursor-pointer group flex flex-col justify-between hover:shadow-xl relative overflow-hidden"
                  >
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden shrink-0">
                            {client.avatar_url ? (
                              <img src={client.avatar_url} alt={client.full_name} className="w-full h-full object-cover" />
                            ) : (
                              <User size={20} />
                            )}
                          </div>
                          <div>
                            <h3 className="font-syne font-bold text-foreground group-hover:text-primary transition-colors text-base line-clamp-1">
                              {client.full_name}
                            </h3>
                            {client.company_name && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{client.company_name}</p>
                            )}
                          </div>
                        </div>

                        {client.client_code && (
                          <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded border border-border shrink-0">
                            {client.client_code}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-border/40 text-xs text-muted-foreground">
                        {client.phone && (
                          <div className="flex items-center gap-2">
                            <Phone size={12} className="text-primary/70" />
                            <span>{client.phone}</span>
                          </div>
                        )}
                        {client.email && (
                          <div className="flex items-center gap-2 truncate">
                            <Mail size={12} className="text-primary/70 shrink-0" />
                            <span className="truncate">{client.email}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-border/40 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs">
                        <div>
                          <span className="font-bold text-foreground">{activeJobs.length}</span>
                          <span className="text-[10px] text-muted-foreground uppercase ml-1">{isRtl ? 'نشط' : 'Active'}</span>
                        </div>
                        <span className="text-border">•</span>
                        <div>
                          <span className="font-bold text-muted-foreground">{clientJobs.length}</span>
                          <span className="text-[10px] text-muted-foreground opacity-60 uppercase ml-1">{isRtl ? 'الإجمالي' : 'Total'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (onEditClient) onEditClient(client);
                          }}
                          className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                          title={isRtl ? 'تعديل العميل' : 'Edit Client'}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setClientToDelete(client);
                            setDeleteModalOpen(true);
                          }}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                          title={isRtl ? 'حذف العميل' : 'Delete Client'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" dir={isRtl ? 'rtl' : 'ltr'}>
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-right">
                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-start">{isRtl ? 'العميل' : 'Client'}</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest hidden sm:table-cell text-start">{isRtl ? 'معلومات الاتصال' : 'Contact Info'}</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest hidden md:table-cell text-start">{isRtl ? 'تاريخ الانضمام' : 'Joined'}</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-start">{isRtl ? 'المشاريع' : 'Projects'}</th>
                    <th className={`px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest ${isRtl ? 'text-left' : 'text-right'}`}>{isRtl ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(() => {
                    const filtered = clients.filter(c => {
                      const isWalkIn = c.email?.startsWith('walkin_') || c.email?.endsWith('@osbic.local') || c.id?.startsWith('walkin-');
                      
                      if (clientTypeFilter === 'standard' && isWalkIn) return false;
                      if (clientTypeFilter === 'walk-in' && !isWalkIn) return false;

                      if (clientTypeFilter === 'standard') {
                        if (filterType === 'mine' && c.created_by !== profile?.id) return false;
                        if (filterType === 'assigned' && c.created_by === profile?.id) return false;
                      }
                      return true;
                    });
                    
                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground text-sm">
                            {isRtl ? 'لم يتم العثور على عملاء.' : 'No clients found.'}
                          </td>
                        </tr>
                      );
                    }
                    
                    return filtered.map(client => {
                      const clientJobs = jobs.filter(j => j.client_id === client.id);
                      const activeJobs = clientJobs.filter(j => j.status === 'active' || j.status === 'in_progress');
                      
                      return (
                        <tr 
                          key={client.id}
                          onClick={() => onClientSelect(client.id)}
                          className="group hover:bg-muted/30 transition-colors cursor-pointer"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden shrink-0">
                                {client.avatar_url ? (
                                  <img src={client.avatar_url} alt={client.full_name} className="w-full h-full object-cover" />
                                ) : (
                                  <User size={16} />
                                )}
                              </div>
                              <div>
                                <p className="font-syne font-bold text-foreground group-hover:text-primary transition-colors">{client.full_name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  {client.client_code && (
                                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{client.client_code}</span>
                                  )}
                                  {clientTypeFilter === 'standard' && client.created_by === profile?.id && (
                                    <span className="inline-block px-1.5 py-0.5 rounded md bg-primary/10 text-primary text-[8px] font-bold uppercase tracking-widest border border-primary/20">
                                      {isRtl ? 'عميلي' : 'My Client'}
                                    </span>
                                  )}
                                  {clientTypeFilter === 'standard' && client.created_by !== profile?.id && client.created_by && (
                                    <span className="inline-block px-1.5 py-0.5 rounded md bg-amber-500/10 text-amber-500 text-[8px] font-bold uppercase tracking-widest border border-amber-500/20">
                                      {isRtl ? 'مسند' : 'Assigned'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          
                          <td className="px-6 py-4 hidden sm:table-cell">
                            <div className="flex flex-col gap-1">
                              {client.email && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Mail size={12} /> {client.email}
                                </div>
                              )}
                              {client.phone && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Phone size={12} /> {client.phone}
                                </div>
                              )}
                              {!client.email && !client.phone && (
                                <span className="text-xs text-muted-foreground/50">N/A</span>
                              )}
                            </div>
                          </td>
                          
                          <td className="px-6 py-4 hidden md:table-cell text-sm text-muted-foreground">
                            {client.created_at ? new Date(client.created_at).toLocaleDateString(isRtl ? 'ar-OM' : 'en-US') : 'Unknown'}
                          </td>
                          
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="text-center">
                                <p className="text-sm font-bold text-foreground">{activeJobs.length}</p>
                                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{isRtl ? 'نشط' : 'Active'}</p>
                              </div>
                              <div className="w-[1px] h-6 bg-border" />
                              <div className="text-center">
                                <p className="text-sm font-bold text-muted-foreground">{clientJobs.length}</p>
                                <p className="text-[9px] uppercase tracking-widest text-muted-foreground opacity-50">{isRtl ? 'الإجمالي' : 'Total'}</p>
                              </div>
                            </div>
                          </td>
                          
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={(e) => { 
                                 e.stopPropagation(); 
                                 if (onEditClient) onEditClient(client);
                               }}
                               className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                               title={isRtl ? 'تعديل العميل' : 'Edit Client'}
                             >
                               <Edit2 size={16} />
                             </button>
                             <button 
                               onClick={(e) => { 
                                 e.stopPropagation(); 
                                 setClientToDelete(client);
                                 setDeleteModalOpen(true);
                               }}
                               className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                               title={isRtl ? 'حذف العميل' : 'Delete Client'}
                             >
                               <Trash2 size={16} />
                             </button>
                             <button className={`p-2 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 rounded-lg transition-all ml-2 ${isRtl ? 'rotate-180' : ''}`}>
                               <ChevronRight size={18} />
                             </button>
                           </div>
                         </td>
                       </tr>
                     );
                   });
                 })()}
               </tbody>
             </table>
           </div>
         </div>
       )}
      </div>
      
      <DeleteClientModal 
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setClientToDelete(null);
        }}
        client={clientToDelete}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeletingClient}
      />
    </div>
  );
};
