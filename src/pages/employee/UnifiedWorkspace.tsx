import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminJobs, useEmployeeJobs } from '../../hooks/shared/useJobs';
import { useAdminClients, useEmployeeClients } from '../../hooks/admin/useAdminClients';
import { JobDetailsView } from '../../components/employee/JobDetailsView';
import { ClientDetailsView } from '../../components/employee/ClientDetailsView';
import { ClientListView } from '../../components/employee/ClientListView';
import { TaskListView } from '../../components/employee/TaskListView';
import { Search, Plus, Clock, ArrowLeft, X, User, UserCheck, LayoutGrid, List, Zap, Briefcase, ChevronDown, Calendar } from 'lucide-react';
import { JobBuilder } from '../../components/employee/JobBuilder';
import CreateClientSlideOver from '../../components/shared/clients/CreateClientSlideOver';
import WalkInModal from '../../components/employee/WalkInModal';

import { useTranslation } from 'react-i18next';

interface UnifiedWorkspaceProps {
  filterType: 'tasks' | 'clients' | 'pipeline';
}

const UnifiedWorkspace: React.FC<UnifiedWorkspaceProps> = ({ filterType }) => {
  const { profile } = useAuth();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  const isManager = Boolean(profile?.is_manager);
  const adminQuery = useAdminJobs(profile?.branch_id, isManager);
  const employeeQuery = useEmployeeJobs(profile?.id || '', !isManager);

  const jobs = isManager ? adminQuery.data : employeeQuery.data;
  const isJobsLoading = isManager ? adminQuery.isLoading : employeeQuery.isLoading;
  const refetch = isManager ? adminQuery.refetch : employeeQuery.refetch;

  const adminClientsQuery = useAdminClients(null, isManager);
  const employeeClientsQuery = useEmployeeClients(profile?.id, !isManager);
  const realClients = isManager ? adminClientsQuery.data : employeeClientsQuery.data;
  const isClientsLoading = isManager ? adminClientsQuery.isLoading : employeeClientsQuery.isLoading;
  const isLoading = isJobsLoading || isClientsLoading;

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientViewMode, setClientViewMode] = useState<'split' | 'list'>('list');
  const [taskViewMode, setTaskViewMode] = useState<'split' | 'list'>('list');
  const [taskFilter, setTaskFilter] = useState<'all' | 'self' | 'manager' | 'coworker'>('all');
  const [jobTypeFilter, setJobTypeFilter] = useState<'standard' | 'quick'>('standard');
  const [clientTypeFilter, setClientTypeFilter] = useState<'standard' | 'walk-in'>('standard');
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [viewGrouping, setViewGrouping] = useState<'client' | 'flat'>('client');
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [isBuildingJob, setIsBuildingJob] = useState(false);
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  const [isRegisterClientOpen, setIsRegisterClientOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<any>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const urlJobId = searchParams.get('jobId');
    if (urlJobId && jobs && jobs.find(j => j.id === urlJobId)) {
      setSelectedJobId(urlJobId);
      setTaskViewMode('split');
    }
    const action = searchParams.get('action');
    if (action === 'new-project') {
      setIsBuildingJob(true);
    }
  }, [searchParams, jobs]);

  // Filtering logic based on role & view type
  const getFilteredJobs = () => {
    if (!jobs || !profile) return [];

    switch (filterType) {
      case 'tasks':
        let taskJobs = jobs.filter(job =>
          job.employee_id === profile.id ||
          job.sales_employee_id === profile.id ||
          job.assigned_by === profile.id ||
          job.is_operator
        );
        if (taskFilter === 'self') {
          taskJobs = taskJobs.filter(j => j.assigned_by === profile.id);
        } else if (taskFilter === 'manager') {
          taskJobs = taskJobs.filter(j => j.assigned_by_role === 'admin' || j.assigned_by_role === 'manager');
        } else if (taskFilter === 'coworker') {
          taskJobs = taskJobs.filter(j => j.assigned_by !== profile.id && j.assigned_by_role === 'employee');
        }
        return taskJobs;

      case 'clients':
        // My Clients: For managers, show all branch jobs; for employees, show jobs they created or are assigned to
        return profile.is_manager
          ? (jobs || [])
          : jobs.filter(job => job.assigned_by === profile.id || job.employee_id === profile.id || job.sales_employee_id === profile.id);

      case 'pipeline':
        // Sales/Manager view: All jobs
        return profile.is_manager ? jobs : [];

      default:
        return [];
    }
  };

  const getClientName = (job: any) => {
    if (job.service_name === 'Quick Task (POS)' && job.notes) {
      const match = job.notes.match(/Walk-in Name:\s*(.*?)\s*\|/);
      if (match && match[1] && match[1] !== 'Anonymous') {
        return match[1];
      }
    }
    return job.client_name;
  };

  const filteredJobs = getFilteredJobs();
  const quickTasks = filteredJobs.filter(j => j.service_name === 'Quick Task (POS)' || j.entry_type === 'walkin');
  const standardTasks = filteredJobs.filter(j => j.service_name !== 'Quick Task (POS)' && j.entry_type !== 'walkin');

  const baseDisplayJobs = jobTypeFilter === 'quick' ? quickTasks : standardTasks;

  const displayJobs = React.useMemo(() => {
    if (!taskSearchQuery.trim()) return baseDisplayJobs;
    const q = taskSearchQuery.toLowerCase();
    return baseDisplayJobs.filter(j => 
      getClientName(j)?.toLowerCase().includes(q) ||
      j.service_name?.toLowerCase().includes(q) ||
      j.job_code?.toLowerCase().includes(q) ||
      j.notes?.toLowerCase().includes(q)
    );
  }, [baseDisplayJobs, taskSearchQuery]);

  const selectedJob = jobs?.find(j => j.id === selectedJobId);

  // Group display jobs by client with works sorted by date (newest first)
  const clientJobGroups = React.useMemo(() => {
    const groups = new Map<string, {
      clientId: string;
      clientName: string;
      clientAvatar?: string;
      jobs: any[];
      latestDate: string;
      activeCount: number;
    }>();

    displayJobs.forEach(job => {
      const clientName = getClientName(job) || 'Unknown Client';
      const clientId = job.client_id || clientName;

      if (!groups.has(clientId)) {
        groups.set(clientId, {
          clientId,
          clientName,
          clientAvatar: job.client_avatar,
          jobs: [],
          latestDate: job.started_date || job.created_at || '',
          activeCount: 0
        });
      }

      const group = groups.get(clientId)!;
      group.jobs.push(job);
      if (job.status !== 'completed' && job.status !== 'cancelled') {
        group.activeCount++;
      }

      const jobDate = job.started_date || job.created_at || '';
      if (jobDate > group.latestDate) {
        group.latestDate = jobDate;
      }
    });

    // Sort jobs inside each client group by date (newest first)
    groups.forEach(group => {
      group.jobs.sort((a, b) => {
        const dateA = new Date(a.started_date || a.created_at || 0).getTime();
        const dateB = new Date(b.started_date || b.created_at || 0).getTime();
        return dateB - dateA;
      });
    });

    // Sort client groups by their latest job date (newest first)
    return Array.from(groups.values()).sort((a, b) => {
      const dateA = new Date(a.latestDate || 0).getTime();
      const dateB = new Date(b.latestDate || 0).getTime();
      return dateB - dateA;
    });
  }, [displayJobs]);

  // Auto-expand client containing the currently selected job
  useEffect(() => {
    if (selectedJobId && jobs) {
      const found = jobs.find(j => j.id === selectedJobId);
      if (found) {
        const clientName = getClientName(found) || 'Unknown Client';
        const clientId = found.client_id || clientName;
        setExpandedClients(prev => ({ ...prev, [clientId]: true }));
      }
    }
  }, [selectedJobId, jobs]);

  // Derive unique clients from the filtered jobs & DB profiles
  const uniqueClients = React.useMemo(() => {
    // 1. Separate real database profiles into Standard vs Walk-in
    const dbProfiles = realClients || [];
    const dbStandard = dbProfiles.filter(p => !p.email?.startsWith('walkin_') && !p.email?.endsWith('@osbic.local'));
    const dbWalkIn = dbProfiles.filter(p => p.email?.startsWith('walkin_') || p.email?.endsWith('@osbic.local'));

    if (clientTypeFilter === 'walk-in') {
      // Walk-in tab: Combine database walk-in profiles AND extracted walk-ins from quick tasks
      const walkInClientsMap = new Map();

      // Add DB walk-in profiles
      dbWalkIn.forEach(p => {
        walkInClientsMap.set(p.id, {
          id: p.id,
          full_name: p.full_name,
          company_name: p.company_name,
          avatar_url: p.avatar_url,
          created_at: p.created_at,
          email: p.email,
          phone: p.phone,
          client_code: p.client_code || 'WALKIN',
          created_by: p.created_by
        });
      });

      // Extract walk-ins from quick tasks
      if (jobs) {
        jobs.forEach(job => {
          if (filterType === 'clients' && (job.employee_id === profile?.id || profile?.is_manager)) {
            if (job.service_name === 'Quick Task (POS)' && job.client_name === 'Walk-in Customer') {
              const actualName = getClientName(job);

              let phone = undefined;
              if (job.notes) {
                const phoneMatch = job.notes.match(/\((.*?)\)/);
                if (phoneMatch && phoneMatch[1] && phoneMatch[1] !== 'Anonymous') {
                  phone = phoneMatch[1];
                }
              }

              const key = `${actualName}-${phone || 'no-phone'}`;

              // Only add if not already in map under a DB profile id
              if (!walkInClientsMap.has(`walkin-${key}`)) {
                walkInClientsMap.set(`walkin-${key}`, {
                  id: `walkin-${key}`,
                  full_name: actualName,
                  company_name: undefined,
                  avatar_url: null,
                  created_at: job.started_date,
                  email: undefined,
                  phone: phone,
                  client_code: `WALKIN`,
                  created_by: job.employee_id
                });
              }
            }
          }
        });
      }

      return Array.from(walkInClientsMap.values());
    } else {
      // Standard Clients tab: return only the standard database profiles
      return dbStandard;
    }
  }, [jobs, realClients, clientTypeFilter, filterType, profile]);

  const selectedClient = uniqueClients.find(c => c.id === selectedClientId);
  const clientJobs = React.useMemo(() => {
    if (!jobs || !selectedClientId) return [];
    if (clientTypeFilter === 'walk-in' && selectedClient) {
      return jobs.filter(j => getClientName(j) === selectedClient.full_name && j.client_name === 'Walk-in Customer');
    }
    return jobs.filter(j => j.client_id === selectedClientId);
  }, [jobs, selectedClientId, clientTypeFilter, selectedClient]);

  const renderJobBuilderModal = () => {
    const handleClose = () => {
      setIsBuildingJob(false);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      newParams.delete('clientId');
      newParams.delete('serviceId');
      newParams.delete('entryType');
      setSearchParams(newParams);
    };

    return (
      <AnimatePresence>
        {isBuildingJob && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-3xl max-h-[90vh] bg-[#1a2130] rounded-[32px] overflow-hidden shadow-2xl relative flex flex-col border border-white/10"
            >
              <JobBuilder
                onClose={handleClose}
                onJobCreated={() => {
                  handleClose();
                  refetch(); // Refetch jobs after creation
                }}
                preSelectedClientId={searchParams.get('clientId')}
                preSelectedServiceId={searchParams.get('serviceId')}
                preSelectedEntryType={searchParams.get('entryType') as any}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const renderModals = () => (
    <>
      {renderJobBuilderModal()}
      <WalkInModal
        isOpen={isWalkInOpen}
        onClose={() => setIsWalkInOpen(false)}
        onJobCreated={() => {
          setIsWalkInOpen(false);
          refetch();
        }}
      />
      {isRegisterClientOpen && (
        <CreateClientSlideOver
          isOpen={isRegisterClientOpen}
          onClose={() => {
            setIsRegisterClientOpen(false);
            setClientToEdit(null);
          }}
          clientToEdit={clientToEdit}
        />
      )}
    </>
  );

  if (filterType === 'clients' && clientViewMode === 'list') {
    if (selectedClientId && selectedClient) {
      return (
        <>
          {renderModals()}
          <div className="h-full flex flex-col overflow-hidden bg-background">
            <div className="h-16 border-b border-border bg-background/50 backdrop-blur-md px-4 lg:px-8 flex items-center gap-4 shrink-0">
              <button
                onClick={() => setSelectedClientId(null)}
                className="p-2 bg-muted/50 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-2 text-sm font-semibold"
              >
                <ArrowLeft size={18} />
                <span>{isRtl ? 'العودة إلى العملاء' : 'Back to Clients'}</span>
              </button>
              <div className="border-l border-border pl-4">
                <h2 className="text-base lg:text-lg font-syne font-bold text-foreground">{selectedClient.full_name}</h2>
                <p className="text-[10px] font-bold text-primary tracking-widest uppercase">{selectedClient.client_code || 'CLIENT'}</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ClientDetailsView
                client={selectedClient}
                jobs={clientJobs}
                onJobClick={(jobId) => {
                  setSelectedClientId(null);
                  setSelectedJobId(jobId);
                }}
              />
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        {renderModals()}
        <div className="h-full flex overflow-hidden bg-background">
          <ClientListView
            clients={uniqueClients}
            jobs={jobs || []}
            isLoading={isLoading}
            onClientSelect={(clientId) => setSelectedClientId(clientId)}
            onViewToggle={setClientViewMode}
            currentMode={clientViewMode}
            clientTypeFilter={clientTypeFilter}
            onClientTypeChange={setClientTypeFilter}
            onNewClient={() => {
              setClientToEdit(null);
              setIsRegisterClientOpen(true);
            }}
            onEditClient={(client) => {
              setClientToEdit(client);
              setIsRegisterClientOpen(true);
            }}
          />
        </div>
      </>
    );
  }

  if (filterType === 'tasks' && taskViewMode === 'list') {
    return (
      <>
        {renderModals()}
        <div className="h-full flex overflow-hidden bg-background">
          <TaskListView
            jobs={jobs || []}
            activeFilter={taskFilter}
            onFilterChange={setTaskFilter}
            profileId={profile?.id || ''}
            onTaskSelect={(jobId) => {
              setSelectedJobId(jobId);
              setTaskViewMode('split');
              setSearchParams({ jobId });
            }}
            onViewToggle={setTaskViewMode}
            currentMode={taskViewMode}
            jobTypeFilter={jobTypeFilter}
            onJobTypeChange={setJobTypeFilter}
            onNewTask={() => setIsBuildingJob(true)}
            onWalkIn={() => setIsWalkInOpen(true)}
            onTaskUpdated={refetch}
          />
        </div>
      </>
    );
  }

  return (
    <>
      {renderModals()}
      <div className="h-full w-full min-w-0 flex overflow-hidden bg-background rounded-2xl border border-border">
        {/* ── Left Pane: Master List ── */}
        <div className={`flex flex-col border-r border-border transition-all duration-300 ${(selectedJobId || selectedClientId) ? 'w-full lg:w-80 xl:w-96 shrink-0 hidden lg:flex' : 'w-full lg:w-80 xl:w-96 shrink-0'
          }`}>

          {/* Header & Controls */}
          <div className="p-6 border-b border-border bg-card shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl md:text-2xl font-syne font-bold text-foreground capitalize whitespace-nowrap">
                {filterType === 'tasks' ? t('ops.tasks') : filterType === 'clients' ? t('ops.clients') : t('ops.pipeline')}
              </h2>
              {filterType === 'pipeline' && (
                <button
                  onClick={() => {
                    setSelectedJobId(null);
                    setSelectedClientId(null);
                    setIsBuildingJob(true);
                  }}
                  className="p-2 bg-primary text-primary-foreground rounded-xl shadow-lg hover:scale-105 transition-all"
                >
                  <Plus size={20} />
                </button>
              )}
              {filterType === 'clients' && (
                <div className="flex bg-muted/50 p-1 rounded-xl border border-border">
                  <button
                    onClick={() => setClientViewMode('split')}
                    className={`p-1.5 rounded-lg transition-all ${clientViewMode === 'split' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    onClick={() => setClientViewMode('list')}
                    className={`p-1.5 rounded-lg transition-all ${clientViewMode === 'list' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <List size={16} />
                  </button>
                </div>
              )}

              {filterType === 'tasks' && (
                <div className="flex bg-muted/50 p-1 rounded-xl border border-border">
                  <button
                    onClick={() => setTaskViewMode('split')}
                    className={`p-1.5 rounded-lg transition-all ${taskViewMode === 'split' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    onClick={() => setTaskViewMode('list')}
                    className={`p-1.5 rounded-lg transition-all ${taskViewMode === 'list' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <List size={16} />
                  </button>
                </div>
              )}
            </div>

            {filterType === 'tasks' && taskViewMode === 'split' && (
              <div className="flex bg-muted/50 p-1 rounded-xl border border-border mb-4 w-full">
                <button
                  onClick={() => setJobTypeFilter('standard')}
                  className={`flex-1 flex justify-center items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest whitespace-nowrap shrink-0 transition-all ${jobTypeFilter === 'standard' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Briefcase size={14} /> {isRtl ? 'اعتيادي' : 'Standard'}
                </button>
                <button
                  onClick={() => setJobTypeFilter('quick')}
                  className={`flex-1 flex justify-center items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest whitespace-nowrap shrink-0 transition-all ${jobTypeFilter === 'quick' ? 'bg-card shadow-sm text-amber-500' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Zap size={14} /> {isRtl ? 'حضور مباشر' : 'Walk-in'}
                </button>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <div className="flex gap-2">
                <div className="flex-1 bg-muted/50 border border-border rounded-xl flex items-center px-3 focus-within:border-primary/50 transition-colors">
                  <Search size={16} className="text-muted-foreground mr-2 shrink-0" />
                  <input
                    type="text"
                    value={taskSearchQuery}
                    onChange={(e) => setTaskSearchQuery(e.target.value)}
                    placeholder={t('ops.search_placeholder') || 'Search client, service, or job code...'}
                    className="w-full bg-transparent py-2.5 text-sm outline-none text-foreground placeholder:text-muted-foreground/60"
                  />
                  {taskSearchQuery && (
                    <button onClick={() => setTaskSearchQuery('')} className="text-muted-foreground hover:text-foreground p-1">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* View grouping toggle: Grouped by Client vs Flat List */}
              {filterType === 'tasks' && (
                <div className="flex items-center justify-between text-[11px] font-sans px-1">
                  <span className="text-muted-foreground font-semibold">
                    {viewGrouping === 'client' 
                      ? `${clientJobGroups.length} ${isRtl ? 'عميل' : clientJobGroups.length === 1 ? 'Client' : 'Clients'}` 
                      : `${displayJobs.length} ${isRtl ? 'مهمة' : displayJobs.length === 1 ? 'Task' : 'Tasks'}`}
                  </span>
                  <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border">
                    <button
                      onClick={() => setViewGrouping('client')}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                        viewGrouping === 'client' ? 'bg-card text-primary shadow-sm font-black' : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title={isRtl ? 'تجميع حسب العميل (قائمة منسدلة)' : 'Group by Client (Accordion)'}
                    >
                      {isRtl ? 'حسب العميل' : 'By Client'}
                    </button>
                    <button
                      onClick={() => setViewGrouping('flat')}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                        viewGrouping === 'flat' ? 'bg-card text-primary shadow-sm font-black' : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title={isRtl ? 'عرض قائمة المعاملات كاملة' : 'Flat List (All Tasks)'}
                    >
                      {isRtl ? 'كل المعاملات' : 'All Tasks'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Task / Client List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
            {isLoading ? (
              <div className="text-center text-muted-foreground p-8 text-sm animate-pulse">{isRtl ? 'جاري تحميل مساحة العمل...' : 'Loading workspace...'}</div>
            ) : filterType === 'clients' ? (
              uniqueClients.length === 0 ? (
                <div className="text-center p-8 border border-dashed border-border rounded-2xl bg-muted/10">
                  <p className="text-muted-foreground text-sm font-medium">{isRtl ? 'لم يتم العثور على عملاء.' : 'No clients found.'}</p>
                </div>
              ) : (
                uniqueClients.map(client => (
                  <div
                    key={client.id}
                    onClick={() => {
                      setSelectedClientId(client.id);
                      setSelectedJobId(null);
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group flex items-center gap-4 ${selectedClientId === client.id
                        ? 'bg-primary/10 border-primary/30 shadow-inner'
                        : 'bg-card border-border hover:border-primary/30 hover:shadow-lg shadow-black/5'
                      }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden shrink-0">
                      {client.avatar_url ? (
                        <img src={client.avatar_url} alt={client.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <User size={20} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-syne font-bold truncate ${selectedClientId === client.id ? 'text-primary' : 'text-foreground group-hover:text-primary transition-colors'}`}>
                        {client.full_name}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                    </div>
                  </div>
                ))
              )
            ) : displayJobs.length === 0 ? (
              <div className="text-center p-8 border border-dashed border-border rounded-2xl bg-muted/10">
                <p className="text-muted-foreground text-sm font-medium">{t('ops.no_tasks')}</p>
              </div>
            ) : viewGrouping === 'client' ? (
              /* ── Grouped by Client: Clean Accordion Rows (Client shown only once) ── */
              <div className="space-y-3">
                {clientJobGroups.map(group => {
                  const isExpanded = expandedClients[group.clientId] ?? (group.jobs.some(j => j.id === selectedJobId) || clientJobGroups.length === 1);
                  const hasSelected = group.jobs.some(j => j.id === selectedJobId);

                  return (
                    <div 
                      key={group.clientId} 
                      className={`rounded-2xl border transition-all overflow-hidden ${
                        hasSelected 
                          ? 'border-primary/40 bg-card shadow-sm ring-1 ring-primary/20' 
                          : 'border-border bg-card hover:border-primary/30 shadow-sm'
                      }`}
                    >
                      {/* Client Summary Header Row (Shown ONCE) */}
                      <div 
                        onClick={() => setExpandedClients(prev => ({ ...prev, [group.clientId]: !isExpanded }))}
                        className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors select-none"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0 overflow-hidden">
                            {group.clientAvatar ? (
                              <img src={group.clientAvatar} alt={group.clientName} className="w-full h-full object-cover" />
                            ) : (
                              group.clientName.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-syne font-bold text-xs md:text-sm text-foreground truncate" title={group.clientName}>
                                {group.clientName}
                              </h3>
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 shrink-0">
                                {group.jobs.length} {group.jobs.length === 1 ? (isRtl ? 'معاملة' : 'Work') : (isRtl ? 'معاملات' : 'Works')}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                              <Clock size={11} className="shrink-0" />
                              <span>
                                {isRtl ? 'آخر تحديث: ' : 'Latest: '}
                                {group.latestDate ? new Date(group.latestDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {group.activeCount > 0 && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title={`${group.activeCount} active`} />
                          )}
                          <div className={`p-1 rounded-lg text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180 text-foreground bg-muted/50' : ''}`}>
                            <ChevronDown size={15} />
                          </div>
                        </div>
                      </div>

                      {/* Expanded Works List Under This Client - Sorted by Date */}
                      {isExpanded && (
                        <div className="border-t border-border/50 bg-muted/20 p-2 space-y-1.5">
                          {group.jobs.map(job => {
                            const isSelected = selectedJobId === job.id;
                            const formattedDate = (job.started_date || job.created_at) 
                              ? new Date(job.started_date || job.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) 
                              : '';

                            return (
                              <div
                                key={job.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedJobId(job.id);
                                  setSelectedClientId(null);
                                }}
                                className={`p-3 rounded-xl border transition-all cursor-pointer group flex flex-col gap-1.5 ${
                                  isSelected
                                    ? (jobTypeFilter === 'quick' ? 'bg-amber-500/15 border-amber-500/40 shadow-sm' : 'bg-primary/15 border-primary/40 shadow-sm')
                                    : 'bg-card border-border/60 hover:border-primary/30 hover:bg-card/90'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`text-[9px] font-mono font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${
                                    isSelected 
                                      ? 'bg-background text-primary border-primary/30 font-bold' 
                                      : 'bg-muted/50 text-muted-foreground border-border'
                                  }`}>
                                    {job.job_code}
                                  </span>
                                  {formattedDate && (
                                    <span className="text-[10px] text-muted-foreground/80 font-medium flex items-center gap-1">
                                      <Calendar size={10} className="shrink-0" /> {formattedDate}
                                    </span>
                                  )}
                                </div>

                                <h4 className={`font-syne text-xs font-bold leading-snug line-clamp-2 ${
                                  isSelected 
                                    ? (jobTypeFilter === 'quick' ? 'text-amber-500' : 'text-primary') 
                                    : 'text-foreground group-hover:text-primary transition-colors'
                                }`}>
                                  {job.service_name}
                                </h4>

                                <div className="flex items-center justify-between text-[9px] pt-1 border-t border-border/30">
                                  <span className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                                    job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                                    job.status === 'draft' ? 'bg-muted text-muted-foreground' :
                                    'bg-amber-500/10 text-amber-500'
                                  }`}>
                                    {job.status}
                                  </span>
                                  {(job.assigner_name || job.sales_employee?.full_name || job.assigner?.full_name) && (
                                    <span className="text-muted-foreground truncate max-w-[140px]">
                                      By: <strong className="text-amber-400/90 font-bold">{job.assigner_name || job.sales_employee?.full_name || job.assigner?.full_name}</strong>
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── Flat List Mode ── */
              <div className="space-y-3">
                {displayJobs.map(job => (
                  <div
                    key={job.id}
                    onClick={() => {
                      setSelectedJobId(job.id);
                      setSelectedClientId(null);
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group ${selectedJobId === job.id
                        ? (jobTypeFilter === 'quick' ? 'bg-amber-500/10 border-amber-500/30 shadow-inner' : 'bg-primary/10 border-primary/30 shadow-inner')
                        : `bg-card border-border hover:shadow-lg shadow-black/5 ${jobTypeFilter === 'quick' ? 'hover:border-amber-500/30' : 'hover:border-primary/30'}`
                      }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-[10px] font-mono font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${jobTypeFilter === 'quick' ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' : 'text-primary bg-primary/10 border-primary/20'}`}>
                        {job.job_code}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-muted-foreground">
                        <User size={12} />
                        {getClientName(job)}
                      </div>
                    </div>
                    <h3 className={`font-syne font-bold leading-tight mb-2 ${selectedJobId === job.id ? (jobTypeFilter === 'quick' ? 'text-amber-500' : 'text-primary') : `text-foreground transition-colors ${jobTypeFilter === 'quick' ? 'group-hover:text-amber-500' : 'group-hover:text-primary'}`}`}>
                      {job.service_name}
                    </h3>

                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/40 text-[10px]">
                      <span className={`px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                          job.status === 'draft' ? 'bg-muted text-muted-foreground' :
                            'bg-amber-500/10 text-amber-500'
                        }`}>
                        {job.status}
                      </span>
                      {(job.assigner_name || job.sales_employee?.full_name || job.assigner?.full_name) && (
                        <span className="text-muted-foreground truncate max-w-[160px]">
                          By: <strong className="text-amber-400 font-bold">{job.assigner_name || job.sales_employee?.full_name || job.assigner?.full_name}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {selectedJobId && selectedJob ? (
            <motion.div
              key={selectedJobId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 min-w-0 flex flex-col bg-card relative z-10 border-l border-border shadow-[-20px_0_40px_-15px_rgba(0,0,0,0.1)] lg:shadow-none overflow-hidden"
            >
              {/* We will build the StepDetailsDrawer / JobBuilder / Ledger components inside here */}
              <div className="h-16 lg:h-20 border-b border-border bg-background/50 backdrop-blur-md px-4 lg:px-6 flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => {
                      setSelectedJobId(null);
                      setTaskViewMode('list');
                      setSearchParams({});
                    }}
                    className="p-2 bg-muted/50 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div className="min-w-0">
                    <h2 className="text-base lg:text-xl font-syne font-bold text-foreground truncate">Job Details</h2>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[10px] font-bold text-primary tracking-widest uppercase truncate">{selectedJob.job_code}</p>
                      {(selectedJob.assigner_name || selectedJob.sales_employee?.full_name || selectedJob.assigner?.full_name || (selectedJob as any)?.assigned_by_profile?.full_name) && (
                        <span className="text-[10px] text-amber-400 font-medium truncate flex items-center gap-1">
                          <UserCheck size={11} className="text-amber-400 shrink-0" />
                          By: <strong className="font-bold text-amber-300">{selectedJob.assigner_name || selectedJob.sales_employee?.full_name || selectedJob.assigner?.full_name || (selectedJob as any)?.assigned_by_profile?.full_name}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <JobDetailsView job={selectedJob} onUpdated={refetch} />
            </motion.div>
          ) : selectedClientId && selectedClient ? (
            <motion.div
              key={selectedClientId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 min-w-0 flex flex-col bg-card relative z-10 border-l border-border shadow-[-20px_0_40px_-15px_rgba(0,0,0,0.1)] lg:shadow-none overflow-hidden"
            >
              <div className="h-16 lg:h-20 border-b border-border bg-background/50 backdrop-blur-md px-4 lg:px-6 flex items-center gap-4 shrink-0">
                <button
                  onClick={() => {
                    setSelectedClientId(null);
                    setClientViewMode('list');
                  }}
                  className="p-2 bg-muted/50 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="min-w-0">
                  <h2 className="text-base lg:text-xl font-syne font-bold text-foreground truncate">Client Details</h2>
                </div>
              </div>

              <ClientDetailsView
                client={selectedClient}
                jobs={clientJobs}
                onJobClick={(jobId) => {
                  setSelectedClientId(null);
                  setSelectedJobId(jobId);
                }}
              />
            </motion.div>
          ) : (
            <div className="hidden lg:flex flex-1 items-center justify-center bg-background">
              <div className="text-center text-muted-foreground opacity-50">
                <div className="w-24 h-24 rounded-full bg-muted/20 border border-border mx-auto mb-6 flex items-center justify-center">
                  <Search size={32} />
                </div>
                <p className="text-sm font-bold uppercase tracking-widest">
                  {filterType === 'pipeline' ? 'Select a task or create a new job' : 'Select a task to view details'}
                </p>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default UnifiedWorkspace;
