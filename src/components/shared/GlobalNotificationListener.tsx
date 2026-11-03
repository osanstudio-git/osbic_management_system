import { useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { playNotificationSound } from '../../utils/audio';
import toast from 'react-hot-toast';
import { Bell, X, ShieldAlert, AlertTriangle, Info, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

const getIcon = (type: string) => {
  switch(type) {
    case 'action_required': return <ShieldAlert size={20} className="text-red-500" />;
    case 'expiry': return <AlertTriangle size={20} className="text-amber-500" />;
    case 'payment': return <Bell size={20} className="text-emerald-500" />;
    default: return <Info size={20} className="text-blue-500" />;
  }
};

const getIconBg = (type: string) => {
  switch(type) {
    case 'action_required': return 'bg-red-500/10 border-red-500/20';
    case 'expiry': return 'bg-amber-500/10 border-amber-500/20';
    case 'payment': return 'bg-emerald-500/10 border-emerald-500/20';
    default: return 'bg-blue-500/10 border-blue-500/20';
  }
};

export const GlobalNotificationListener = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Keep track of processed notification IDs to prevent duplicate toasts
  const processedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotif = payload.new as any;
          
          // Only process notifications meant for the current user
          if (newNotif.recipient_id === user.id) {
            
            // Prevent duplicates if multiple listeners fire
            if (processedRef.current.has(newNotif.id)) return;
            processedRef.current.add(newNotif.id);

            // Ignore self-assigned tasks or completed work logged by the user themselves
            if (newNotif.sender_id && newNotif.sender_id === user.id && newNotif.title_en === 'New Task Assigned') {
              supabase.from('notifications').delete().eq('id', newNotif.id);
              return;
            }

            // Invalidate queries so the UI updates instantly
            queryClient.invalidateQueries({ queryKey: ['employee', 'jobs'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });

            // Play the notification sound
            playNotificationSound();

            // Show Custom Toast Popup
            toast.custom((t) => (
              <div
                className={`${
                  t.visible ? 'animate-enter' : 'animate-leave'
                } w-[450px] bg-card shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] rounded-2xl pointer-events-auto flex ring-1 ring-white/10 overflow-hidden border border-border cursor-pointer hover:bg-muted/30 transition-colors group relative`}
                onClick={() => {
                  toast.dismiss(t.id);
                  if (newNotif.action_url) {
                    let url = newNotif.action_url;
                    if (url.startsWith('/employee/my-jobs/')) {
                       url = `/employee/tasks?jobId=${url.split('/').pop()}`;
                    }
                    
                    if (url.startsWith('/')) {
                      navigate(url);
                    } else if (profile?.role === 'admin') {
                       navigate('/admin/notifications');
                    } else if (profile?.role === 'employee') {
                       navigate('/employee/notifications');
                    }
                  } else if (newNotif.job_id && profile?.role === 'employee') {
                     navigate(`/employee/tasks?jobId=${newNotif.job_id}`);
                  } else {
                     if (profile?.role === 'admin') navigate('/admin/notifications');
                     else if (profile?.role === 'employee') navigate('/employee/notifications');
                     else navigate('/portal/messages');
                  }
                }}
              >
                {/* Dismiss Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toast.dismiss(t.id);
                  }}
                  className="absolute top-3 right-3 p-2 rounded-full bg-background border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-all z-20 shadow-sm opacity-0 group-hover:opacity-100"
                >
                  <X size={16} strokeWidth={3} />
                </button>

                <div className="flex-1 w-0 p-4">
                  <div className="flex items-start pr-8">
                    <div className={`flex-shrink-0 pt-0.5 border rounded-xl w-12 h-12 flex items-center justify-center ${getIconBg(newNotif.type)}`}>
                      {getIcon(newNotif.type)}
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-base font-bold text-foreground">
                        {newNotif.title_en}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground/80 line-clamp-2 leading-relaxed">
                        {newNotif.body_en}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[11px] uppercase font-bold tracking-widest text-muted-foreground/60 border-t border-border/50 pt-3">
                     <span>{newNotif.job_id ? `Job ${newNotif.job_id}` : 'System'}</span>
                     <span className="flex items-center gap-1"><Clock size={12} /> Just now</span>
                  </div>
                </div>
                <div className="flex border-l border-border">
                  <div className="w-1.5 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                </div>
              </div>
            ), {
              duration: 5000, // 5 seconds
              position: 'top-right',
            });
          }
        }
      )
      .subscribe();

      // 2. Listen to jobs updates for real-time status transitions & additions
      const jobsChannel = supabase
        .channel('public:jobs-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'jobs' },
          () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
            queryClient.invalidateQueries({ queryKey: ['employee', 'jobs'] });
            queryClient.invalidateQueries({ queryKey: ['client', 'jobs'] });
            queryClient.invalidateQueries({ queryKey: ['job'] });
          }
        )
        .subscribe();
 
      // 3. Listen to job_steps updates for workflow progression & additions
      const stepsChannel = supabase
        .channel('public:job_steps-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'job_steps' },
          () => {
            queryClient.invalidateQueries({ queryKey: ['job'] });
            queryClient.invalidateQueries({ queryKey: ['client', 'active-steps'] });
          }
        )
        .subscribe();
 
      // 4. Listen to documents updates for verification status updates
      const docsChannel = supabase
        .channel('public:documents-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'documents' },
          () => {
            queryClient.invalidateQueries({ queryKey: ['job'] });
            queryClient.invalidateQueries({ queryKey: ['client', 'documents'] });
            queryClient.invalidateQueries({ queryKey: ['client', 'vault'] });
          }
        )
        .subscribe();
 
      // 5. Listen to new messages for real-time chat updates
      const msgsChannel = supabase
        .channel('public:messages-realtime')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          () => {
            queryClient.invalidateQueries({ queryKey: ['job'] });
            queryClient.invalidateQueries({ queryKey: ['messages'] });
          }
        )
        .subscribe();

      // 6. Listen to sub-tasks updates for workflow updates
      const subTasksChannel = supabase
        .channel('public:job_sub_tasks-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'job_sub_tasks' },
          () => {
            queryClient.invalidateQueries({ queryKey: ['job'] });
          }
        )
        .subscribe();

      // 7. Listen to additional charges updates for financial ledger sync
      const chargesChannel = supabase
        .channel('public:job_additional_charges-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'job_additional_charges' },
          () => {
            queryClient.invalidateQueries({ queryKey: ['job'] });
          }
        )
        .subscribe();

      // 8. Listen to custom invoices changes for billing page sync
      const invoicesChannel = supabase
        .channel('public:invoices-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'invoices' },
          () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
          }
        )
        .subscribe();
 
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(stepsChannel);
      supabase.removeChannel(docsChannel);
      supabase.removeChannel(msgsChannel);
      supabase.removeChannel(subTasksChannel);
      supabase.removeChannel(chargesChannel);
      supabase.removeChannel(invoicesChannel);
    };
  }, [user?.id, navigate, profile?.role]);

  return null; // This is a logic-only component
};
