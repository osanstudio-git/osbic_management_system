import React from 'react';
import { Mail, Phone, Calendar, Briefcase, ChevronRight, User } from 'lucide-react';
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
}

interface ClientDetailsViewProps {
  client: ClientProfile;
  jobs: any[]; // The list of jobs belonging to this client
  onJobClick: (jobId: string) => void;
}

export const ClientDetailsView: React.FC<ClientDetailsViewProps> = ({ client, jobs, onJobClick }) => {
  const activeJobs = jobs.filter(j => j.status === 'active' || j.status === 'in_progress');
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const draftJobs = jobs.filter(j => j.status === 'draft' || j.status === 'pending');

  return (
    <div className="flex-1 overflow-y-auto bg-background/50 p-6 sm:p-10 no-scrollbar">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Client Profile Header */}
        <div className="bg-card border border-border rounded-[2rem] p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
          {/* Decorative Background */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-24 h-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-3xl font-bold shadow-inner overflow-hidden">
              {client.avatar_url ? (
                <img src={client.avatar_url} alt={client.full_name} className="w-full h-full object-cover" />
              ) : (
                client.full_name?.charAt(0).toUpperCase() || <User size={40} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-3xl font-syne font-bold text-foreground">{client.full_name}</h2>
                {client.client_code && (
                  <span className="text-[10px] font-mono font-black bg-primary/10 text-primary px-2 py-1 rounded-lg uppercase tracking-widest border border-primary/20">
                    {client.client_code}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-2 mt-2">
                <Calendar size={14} /> Joined {client.created_at ? new Date(client.created_at).toLocaleDateString() : 'Unknown'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 relative z-10 w-full md:w-auto">
            {client.email && (
              <a href={`mailto:${client.email}`} className="flex items-center gap-3 p-3 bg-muted/30 hover:bg-muted/50 border border-border rounded-xl transition-colors text-sm text-foreground">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><Mail size={16} /></div>
                {client.email}
              </a>
            )}
            {client.phone && (
              <a href={`tel:${client.phone}`} className="flex items-center gap-3 p-3 bg-muted/30 hover:bg-muted/50 border border-border rounded-xl transition-colors text-sm text-foreground">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500"><Phone size={16} /></div>
                {client.phone}
              </a>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-center">
             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Active Projects</p>
             <p className="text-3xl font-syne font-bold text-foreground">{activeJobs.length}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-center">
             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Completed</p>
             <p className="text-3xl font-syne font-bold text-emerald-500">{completedJobs.length}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-center">
             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Drafts / Pending</p>
             <p className="text-3xl font-syne font-bold text-amber-500">{draftJobs.length}</p>
          </div>
        </div>

        {/* Associated Jobs List */}
        <div>
           <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                 <Briefcase size={16} />
              </div>
              <h3 className="text-xl font-syne font-bold text-foreground">Client Projects</h3>
           </div>
           
           <div className="space-y-3">
              {jobs.length === 0 ? (
                 <div className="text-center p-12 border border-dashed border-border rounded-3xl bg-muted/10">
                    <p className="text-muted-foreground text-sm font-medium">No projects found for this client.</p>
                 </div>
              ) : (
                 jobs.map((job) => (
                    <motion.div
                       key={job.id}
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       onClick={() => onJobClick(job.id)}
                       className="group bg-card hover:bg-muted/30 border border-border rounded-2xl p-5 flex items-center justify-between cursor-pointer transition-all hover:border-primary/30"
                    >
                       <div className="flex items-center gap-5">
                          <div className={`w-1.5 h-12 rounded-full ${
                             job.status === 'completed' ? 'bg-emerald-500' :
                             job.status === 'draft' ? 'bg-amber-500' : 'bg-primary'
                          }`} />
                          <div>
                             <h4 className="font-syne font-bold text-foreground group-hover:text-primary transition-colors mb-1">
                                {job.service_name}
                             </h4>
                             <div className="flex items-center gap-3">
                                <span className="text-[10px] font-mono font-black text-muted-foreground uppercase tracking-widest">
                                   {job.job_code}
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-widest ${
                                  job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                                  job.status === 'draft' ? 'bg-muted text-muted-foreground' :
                                  'bg-amber-500/10 text-amber-500'
                                }`}>
                                  {job.status}
                                </span>
                             </div>
                          </div>
                       </div>
                       <div className="flex items-center gap-4 text-muted-foreground group-hover:text-primary transition-colors">
                          <div className="text-right hidden sm:block">
                             <p className="text-xs font-bold">{job.total_fee.toFixed(3)} OMR</p>
                             <p className="text-[10px] uppercase tracking-widest opacity-60">Total Value</p>
                          </div>
                          <ChevronRight size={20} />
                       </div>
                    </motion.div>
                 ))
              )}
           </div>
        </div>

      </div>
    </div>
  );
};
