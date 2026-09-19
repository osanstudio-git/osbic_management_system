import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Building2, BookOpen, RefreshCw, Users, FileText, 
  Search, Plus, Filter, AlertCircle, Edit3, Trash2, 
  Copy, ListChecks, Loader2, X, Clock,
  FileCheck, Eye, LayoutGrid, List, CheckCircle2
} from 'lucide-react';
import { useAdminServices, useAdminService, useToggleServiceActive, useDeleteService } from '../../hooks/admin/useAdminServices';
import Skeleton from '../../components/ui/Skeleton';
import DeleteServiceModal from '../../components/admin/DeleteServiceModal';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import toast from 'react-hot-toast';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const IconMap: Record<string, any> = {
  Building2, BookOpen, RefreshCw, Users, FileText
};

const CATEGORY_COLORS: Record<string, string> = {
  company_formation: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  visa: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  cr_renewal: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  labor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  other: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const CATEGORY_LABELS: Record<string, string> = {
  company_formation: 'Company Formation',
  visa: 'Visa Services',
  cr_renewal: 'CR Renewal',
  labor: 'Labor Services',
  other: 'Other Services',
};

const ServicesList = () => {
  const navigate = useNavigate();
  const { data: services, isLoading } = useAdminServices();
  const { mutate: toggleActive, isPending: isToggling } = useToggleServiceActive();
  const { mutate: deleteService, isPending: isDeleting } = useDeleteService();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<{ id: string, name: string } | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data: detailService, isLoading: isDetailLoading } = useAdminService(selectedServiceId || undefined);

  const filteredServices = services?.filter(s => {
    const matchesSearch = s.name_en.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.name_ar.includes(searchQuery);
    const matchesStatus = activeFilter === 'all' ? true : 
                          activeFilter === 'active' ? s.is_active : !s.is_active;
    return matchesSearch && matchesStatus;
  });

  const handleToggle = (id: string, current: boolean) => {
    toggleActive({ id, is_active: !current }, {
      onSuccess: () => toast.success(`Service ${!current ? 'enabled' : 'disabled'}`),
      onError: (err: any) => toast.error(err.message || 'Failed to toggle status')
    });
  };

  const handleDelete = (id: string, name: string) => {
    setServiceToDelete({ id, name });
  };

  const containerAnimations = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemAnimations = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  const stats = {
    total: services?.length || 0,
    active: services?.filter(s => s.is_active).length || 0,
    inactive: services?.filter(s => !s.is_active).length || 0
  };

  const renderList = () => {
    return (
      <div className="bg-card border border-border rounded-[2rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border/80 bg-black/20">
                <th className="py-4 px-6 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60">Service Name</th>
                <th className="py-4 px-6 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60">Arabic Name</th>
                <th className="py-4 px-6 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60">Category</th>
                <th className="py-4 px-6 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60">Estimated Days</th>
                <th className="py-4 px-6 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60">Steps</th>
                <th className="py-4 px-6 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60">Active Jobs</th>
                <th className="py-4 px-6 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60">Status</th>
                <th className="py-4 px-6 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredServices?.map((service) => (
                <tr key={service.id} className="hover:bg-muted/10 transition-colors">
                  <td className="py-4 px-6 text-sm font-bold text-foreground">{service.name_en}</td>
                  <td className="py-4 px-6 text-xs text-muted-foreground font-medium" dir="rtl">{service.name_ar}</td>
                  <td className="py-4 px-6">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider border",
                      CATEGORY_COLORS[service.category] || CATEGORY_COLORS.other
                    )}>
                      {CATEGORY_LABELS[service.category] || 'Other'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-xs text-foreground font-mono">{service.estimated_days} days</td>
                  <td className="py-4 px-6 text-xs text-foreground font-mono">{service.steps_count} steps</td>
                  <td className="py-4 px-6 text-xs text-foreground font-medium">
                    {service.active_jobs > 0 ? (
                      <span className="bg-accent/15 text-accent border border-accent/20 px-2 py-0.5 rounded text-[10px] font-bold">
                        {service.active_jobs} Active
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40 font-mono">-</span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <button 
                      disabled={isToggling}
                      onClick={() => handleToggle(service.id, service.is_active)}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50",
                        service.is_active ? "bg-emerald-500" : "bg-muted"
                      )}
                    >
                      <span className={cn(
                        "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                        service.is_active ? "translate-x-5" : "translate-x-1"
                      )} />
                    </button>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setSelectedServiceId(service.id)}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all"
                        title="View Roadmap"
                      >
                        <Eye size={15} />
                      </button>
                      <button 
                        onClick={() => navigate(`/admin/services/${service.id}`)}
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-xl transition-all"
                        title="Edit Service"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button 
                        disabled={isDeleting}
                        onClick={() => handleDelete(service.id, service.name_en)}
                        className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                        title="Delete Service"
                      >
                        {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-syne font-bold text-foreground">Service Catalog</h1>
          <p className="text-sm text-muted-foreground">Define workflows and manage service offerings</p>
        </div>
        <Link 
          to="/admin/services/new"
          className="flex items-center gap-2 bg-primary text-[#0A0F1E] px-6 py-2.5 rounded-xl font-bold hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all active:scale-95 w-fit"
        >
          <Plus size={18} />
          <span>New Service</span>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Total Services</p>
            <h3 className="text-2xl font-syne font-bold text-foreground mt-2">{stats.total}</h3>
          </div>
          <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center text-primary">
            <Building2 size={24} />
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Active Services</p>
            <h3 className="text-2xl font-syne font-bold text-foreground mt-2">{stats.active}</h3>
          </div>
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500">
            <CheckCircle2 size={24} />
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Inactive Services</p>
            <h3 className="text-2xl font-syne font-bold text-foreground mt-2">{stats.inactive}</h3>
          </div>
          <div className="w-12 h-12 bg-zinc-500/10 border border-zinc-500/20 rounded-xl flex items-center justify-center text-muted-foreground">
            <AlertCircle size={24} />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card border border-border p-2 rounded-2xl shadow-sm">
        <div className="flex-1 w-full sm:w-auto relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <input 
            type="text" 
            placeholder="Search services..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none pl-12 pr-4 py-2 text-foreground placeholder:text-muted-foreground/40 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 pr-2">
          <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted transition-colors border border-transparent hover:border-border flex items-center gap-2">
            <Filter size={16} /> <span className="text-sm font-medium hidden sm:inline">Category</span>
          </button>
          
          <div className="w-[1px] h-6 bg-border mx-2" />
          
          <div className="flex bg-muted/50 p-1 rounded-xl border border-border">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn("p-1.5 rounded-lg transition-all", viewMode === 'grid' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <LayoutGrid size={16} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn("p-1.5 rounded-lg transition-all", viewMode === 'list' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <List size={16} />
            </button>
          </div>

          <div className="w-[1px] h-6 bg-border mx-2" />

          <div className="flex bg-muted/50 p-1 rounded-xl border border-border text-xs font-medium">
            <button 
              onClick={() => setActiveFilter('all')}
              className={cn("px-3 py-1.5 rounded-lg transition-all", activeFilter === 'all' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              All
            </button>
            <button 
              onClick={() => setActiveFilter('active')}
              className={cn("px-3 py-1.5 rounded-lg transition-all", activeFilter === 'active' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              Active
            </button>
            <button 
              onClick={() => setActiveFilter('inactive')}
              className={cn("px-3 py-1.5 rounded-lg transition-all", activeFilter === 'inactive' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              Inactive
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
           {[1,2,3,4,5,6].map(i => <Skeleton key={i} height={200} rounded="xl" />)}
        </div>
      ) : filteredServices?.length === 0 ? (
        <div className="bg-card border border-border rounded-3xl p-20 text-center shadow-sm">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6 opacity-30">
               <FileText size={32} />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No Services Found</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-8">Define your service blueprints and workflows to start registering jobs.</p>
            <Link to="/admin/services/new" className="text-primary font-bold hover:underline inline-flex items-center gap-2">
               Create your first service <ArrowRight size={16} />
            </Link>
        </div>
      ) : viewMode === 'list' ? (
        renderList()
      ) : (
        <motion.div 
          variants={containerAnimations} initial="hidden" animate="show"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
        >
          {filteredServices?.map((service) => {
            const Icon = IconMap[service.icon] || FileText;
            
            return (
              <motion.div key={service.id} variants={itemAnimations} className="bg-card border border-border rounded-3xl p-6 shadow-sm group relative overflow-hidden flex flex-col hover:border-primary/30 transition-all">
                 <div className="flex justify-between items-start mb-5 relative">
                   <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center text-primary transition-transform group-hover:scale-105 shrink-0">
                      <Icon size={22} />
                   </div>
                   
                   <div className="flex items-center gap-2">
                     <span className={cn(
                       "px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border",
                       service.is_active 
                       ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                       : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                     )}>
                       {service.is_active ? 'Active' : 'Inactive'}
                     </span>
                     <button 
                      disabled={isToggling}
                      onClick={() => handleToggle(service.id, service.is_active)}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 shrink-0",
                        service.is_active ? "bg-emerald-500" : "bg-muted"
                      )}
                     >
                       {isToggling ? (
                        <Loader2 size={10} className="animate-spin mx-auto text-foreground" />
                       ) : (
                        <span className={cn(
                          "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                          service.is_active ? "translate-x-5" : "translate-x-1"
                        )} />
                       )}
                     </button>
                   </div>
                 </div>

                 {/* Title & Name */}
                 <div 
                   className="mb-5 cursor-pointer group/title min-w-0"
                   onClick={() => setSelectedServiceId(service.id)}
                 >
                   <div className="flex items-center gap-2 mb-1 flex-wrap">
                     <h3 className="text-base font-syne font-bold text-foreground group-hover/title:text-primary transition-colors line-clamp-2 leading-snug">{service.name_en}</h3>
                     {service.active_jobs > 0 && (
                       <span className="px-1.5 py-0.5 rounded bg-accent/25 text-accent border border-accent/20 text-[9px] font-bold uppercase shrink-0">
                         {service.active_jobs} Jobs
                       </span>
                     )}
                   </div>
                   <p className="text-xs text-muted-foreground/60 font-medium" dir="rtl">{service.name_ar}</p>
                 </div>

                 {/* Metadata */}
                 <div className="flex flex-wrap items-center gap-1.5 mb-6 mt-auto pt-4 border-t border-border/50">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider border",
                      CATEGORY_COLORS[service.category] || CATEGORY_COLORS.other
                    )}>
                      {CATEGORY_LABELS[service.category] || 'Other'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-muted/60 border border-border text-foreground flex items-center gap-1">
                      <Clock size={10} className="text-primary/70" /> {service.estimated_days} Days
                    </span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-muted/60 border border-border text-foreground flex items-center gap-1">
                      <ListChecks size={10} className="text-emerald-500/70" /> {service.steps_count} Steps
                    </span>
                 </div>

                 {/* Dual actions footer */}
                 <div className="flex items-center gap-2 pt-4 border-t border-border/50">
                    <button 
                      onClick={() => setSelectedServiceId(service.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-muted/50 hover:bg-muted/80 text-foreground rounded-xl text-xs font-bold transition-all border border-transparent"
                    >
                       <Eye size={13} /> View Blueprint
                    </button>
                    <button 
                      onClick={() => navigate(`/admin/services/${service.id}`)}
                      className="p-2.5 bg-primary text-[#0A0F1E] hover:shadow-[0_0_15px_rgba(212,175,55,0.2)] rounded-xl transition-all border border-transparent"
                      title="Edit Service"
                    >
                       <Edit3 size={13} />
                    </button>
                    <button 
                      disabled={isDeleting}
                      onClick={() => handleDelete(service.id, service.name_en)}
                      className="p-2.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-transparent shrink-0"
                    >
                       {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                 </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Service Detail Modal */}
      <AnimatePresence>
        {selectedServiceId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedServiceId(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0e1424] border border-border w-full max-w-2xl rounded-[2.5rem] overflow-hidden relative z-10 shadow-2xl flex flex-col max-h-[85vh]"
            >
              {isDetailLoading ? (
                <div className="p-20 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="animate-spin text-primary" size={40} />
                  <p className="text-muted-foreground text-sm animate-pulse">Loading service blueprint...</p>
                </div>
              ) : detailService ? (
                <>
                  <div className="p-6 lg:p-8 border-b border-border/60 flex justify-between items-start gap-4">
                    <div className="flex gap-4 items-center">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                        {(() => {
                          const Icon = IconMap[detailService.icon] || FileText;
                          return <Icon size={28} />;
                        })()}
                      </div>
                      <div>
                        <h2 className="text-xl font-syne font-bold text-foreground leading-tight">{detailService.name_en}</h2>
                        <p className="text-xs text-muted-foreground/60 font-medium" dir="rtl">{detailService.name_ar}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedServiceId(null)}
                      className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-8 scrollbar-thin scrollbar-thumb-border">
                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-muted/20 p-4 rounded-xl border border-border/50">
                        <p className="text-[10px] text-muted-foreground/60 uppercase font-bold tracking-widest mb-1">Category</p>
                        <p className="text-foreground text-xs font-bold">{CATEGORY_LABELS[detailService.category] || 'Other'}</p>
                      </div>
                      <div className="bg-muted/20 p-4 rounded-xl border border-border/50">
                        <p className="text-[10px] text-muted-foreground/60 uppercase font-bold tracking-widest mb-1">Timeline</p>
                        <p className="text-foreground text-xs font-bold">{detailService.estimated_days} Days</p>
                      </div>
                      <div className="bg-muted/20 p-4 rounded-xl border border-border/50">
                        <p className="text-[10px] text-muted-foreground/60 uppercase font-bold tracking-widest mb-1">Blueprint</p>
                        <p className="text-foreground text-xs font-bold uppercase font-mono">{detailService.steps_count} Steps</p>
                      </div>
                    </div>

                    {/* Fees breakdown if present */}
                    <div className="bg-muted/20 p-4 rounded-xl border border-border/50">
                      <p className="text-[10px] text-muted-foreground/60 uppercase font-bold tracking-widest mb-1">Ministry Fee (Fixed Gov Fee)</p>
                      <p className="text-foreground text-sm font-bold font-mono">{(Number(detailService.ministry_fee) || 0).toFixed(3)} OMR</p>
                    </div>

                    {/* Description */}
                    {(detailService.description_en || detailService.description_ar) && (
                      <div className="space-y-3">
                        <h3 className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest flex items-center gap-2">
                           <FileText size={12} /> Description
                        </h3>
                        <div className="bg-muted/20 p-4 rounded-2xl border border-border/40 text-sm text-muted-foreground leading-relaxed">
                          {detailService.description_en || 'No description provided for this service.'}
                          <p className="mt-2 text-right font-medium" dir="rtl">{detailService.description_ar}</p>
                        </div>
                      </div>
                    )}

                    {/* Steps Roadmap */}
                    <div className="space-y-4 pb-4">
                      <h3 className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest flex items-center gap-2">
                         <ListChecks size={12} /> Service Execution Roadmap
                      </h3>
                      
                      <div className="space-y-3">
                        {detailService.steps.length > 0 ? (
                          detailService.steps.map((step, idx) => (
                            <div key={step.id} className="group flex gap-4 p-4 rounded-2xl hover:bg-muted/30 border border-transparent hover:border-border/40 transition-all">
                              <div className="flex flex-col items-center gap-2 mt-1">
                                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold border border-primary/20 shrink-0">
                                  {idx + 1}
                                </div>
                                {idx < detailService.steps.length - 1 && (
                                  <div className="w-[1px] flex-1 bg-border group-hover:bg-primary/30 transition-colors" />
                                )}
                              </div>
                              <div className="flex-1 space-y-2 min-w-0">
                                <div className="flex justify-between items-start gap-4">
                                  <div>
                                    <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{step.name_en}</h4>
                                    <p className="text-[11px] text-muted-foreground/60 font-medium" dir="rtl">{step.name_ar}</p>
                                  </div>
                                  {step.estimated_hours > 0 && (
                                    <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0 uppercase">
                                      <Clock size={10} /> {step.estimated_hours}h
                                    </span>
                                  )}
                                </div>
                                
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {step.description_en}
                                </p>
                                
                                {step.required_docs.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 pt-1">
                                    {step.required_docs.map((doc, dIdx) => (
                                      <span key={dIdx} className="text-[9px] bg-muted text-muted-foreground px-2 py-0.5 rounded border border-border flex items-center gap-1 font-medium">
                                        <FileCheck size={8} className="text-primary/70" /> {doc}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-8 rounded-2xl bg-background/50 border border-dashed border-border flex flex-col items-center justify-center text-center">
                            <AlertCircle size={32} className="text-muted-foreground/50 mb-2" />
                            <p className="text-sm text-muted-foreground/50">No steps have been defined for this service blueprint yet.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-black/10 border-t border-border/60 flex gap-3">
                    <button 
                      onClick={() => {
                        setSelectedServiceId(null);
                        navigate(`/admin/services/${detailService.id}`);
                      }}
                      className="flex-1 py-3 bg-muted/50 hover:bg-muted text-foreground rounded-2xl text-xs font-bold transition-all border border-border"
                    >
                      Edit Blueprint
                    </button>
                    <button 
                      onClick={() => setSelectedServiceId(null)}
                      className="flex-1 py-3 bg-primary text-[#0A0F1E] rounded-2xl text-xs font-bold transition-all shadow-lg hover:shadow-primary/20 active:scale-95"
                    >
                      Close Viewer
                    </button>
                  </div>
                </>
              ) : null}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {serviceToDelete && (
        <DeleteServiceModal 
          isOpen={!!serviceToDelete}
          onClose={() => setServiceToDelete(null)}
          onConfirm={() => {
            deleteService(serviceToDelete.id, {
              onSuccess: () => {
                setServiceToDelete(null);
              },
              onError: () => {
                setServiceToDelete(null);
              }
            });
          }}
          serviceName={serviceToDelete.name}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
};

export default ServicesList;
