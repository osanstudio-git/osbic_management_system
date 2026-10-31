import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, Shield, X, Clock, Briefcase, ChevronRight, User, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { playNotificationSound } from '../../utils/audio';

const MODAL_DURATION_SECONDS = 60; // 1 minute countdown

export const AssignmentBanner = ({ onAccept }: { onAccept?: () => void }) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [dismissedTaskIds, setDismissedTaskIds] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(MODAL_DURATION_SECONDS);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const soundPlayedFor = useRef<Set<string>>(new Set());

  const fetchPending = async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('job_services')
        .select(`
          id,
          service_name,
          applicant_name,
          item_number,
          job_id,
          work_fee,
          ministry_fee,
          total_fee,
          assigned_at,
          created_at,
          service:services(requires_pro),
          job:jobs!job_services_job_id_fkey(
            id,
            job_code,
            custom_name,
            client:clients(id, full_name, phone, company_name),
            sales_employee:profiles!sales_employee_id(full_name)
          )
        `)
        .eq('ops_employee_id', profile.id)
        .eq('acceptance_status', 'pending_acceptance');

      if (!error && data) {
        setPendingTasks(data);

        // Play sound for newly discovered pending tasks
        data.forEach(task => {
          if (!soundPlayedFor.current.has(task.id)) {
            soundPlayedFor.current.add(task.id);
            playNotificationSound();
          }
        });
      }
    } catch (err) {
      console.warn('Failed to fetch pending assignments:', err);
    }
  };

  useEffect(() => {
    fetchPending();

    const channel = supabase
      .channel('ops-assignment-popup-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_services',
          filter: `ops_employee_id=eq.${profile?.id}`
        },
        () => {
          fetchPending();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const visibleTasks = pendingTasks.filter(t => !dismissedTaskIds.includes(t.id));
  const currentTask = visibleTasks[currentIndex] || visibleTasks[0];

  // Reset timer whenever the active task changes
  useEffect(() => {
    if (currentTask) {
      setTimeLeft(MODAL_DURATION_SECONDS);
    }
  }, [currentTask?.id]);

  // 60-Second Countdown timer
  useEffect(() => {
    if (!currentTask) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeout(currentTask.id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentTask?.id]);

  // When 1 minute elapses without user choice
  const handleTimeout = async (taskId: string) => {
    setDismissedTaskIds(prev => [...prev, taskId]);
    toast(
      (t) => (
        <div className="flex items-center gap-2 text-xs">
          <Clock size={16} className="text-amber-400 shrink-0" />
          <span>Assignment window (1 min) expired. You can still claim it from the Open Pool.</span>
        </div>
      ),
      { duration: 4000 }
    );
  };

  const handleAccept = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('job_services')
        .update({
          acceptance_status: 'accepted',
          accepted_at: new Date().toISOString()
        } as any)
        .eq('id', taskId);

      if (error) throw error;

      toast.success('🎉 Task accepted! Added directly to your My Tasks.');
      queryClient.invalidateQueries({ queryKey: ['ops_my_tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my_ops_tasks'] });
      queryClient.invalidateQueries({ queryKey: ['employee', 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['pool_tasks'] });

      fetchPending();
      if (onAccept) onAccept();
    } catch (err: any) {
      toast.error('Failed to accept task: ' + (err.message || ''));
    }
  };

  const handleDecline = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('job_services')
        .update({
          acceptance_status: 'declined',
          ops_employee_id: null,
          declined_at: new Date().toISOString(),
          decline_reason: 'Passed by ops employee'
        } as any)
        .eq('id', taskId);

      if (error) throw error;

      toast('Task passed & returned to dispatch pool', { icon: '↩️' });
      queryClient.invalidateQueries({ queryKey: ['ops_my_tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my_ops_tasks'] });
      queryClient.invalidateQueries({ queryKey: ['employee', 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['pool_tasks'] });

      setDismissedTaskIds(prev => [...prev, taskId]);
      fetchPending();
      if (onAccept) onAccept();
    } catch (err: any) {
      toast.error('Failed to return task');
    }
  };

  if (!currentTask) return null;

  const clientName = currentTask.job?.client?.full_name || currentTask.applicant_name || 'Valued Client';
  const jobCode = currentTask.job?.job_code;
  const salesPerson = currentTask.job?.sales_employee?.full_name;
  const progressPercent = Math.max(0, (timeLeft / MODAL_DURATION_SECONDS) * 100);

  return (
    <AnimatePresence>
      <motion.div
        key={currentTask.id}
        initial={{ opacity: 0, x: 100, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 100, scale: 0.95 }}
        transition={{ type: 'spring', damping: 20, stiffness: 220 }}
        className="fixed top-20 right-6 z-[999999] w-[420px] max-w-[calc(100vw-2rem)] bg-[#0B132B]/95 backdrop-blur-xl border border-amber-500/30 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8),0_0_25px_rgba(212,175,55,0.15)] overflow-hidden text-white"
      >
        {/* Animated Countdown Progress Bar (Top) */}
        <div className="w-full h-1 bg-white/10 relative overflow-hidden">
          <motion.div
            className={`h-full transition-all duration-1000 ease-linear ${
              timeLeft <= 15 ? 'bg-red-500' : timeLeft <= 30 ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                ⚡ New Assignment Offer
              </span>
              {currentTask.service?.requires_pro && (
                <span className="text-[9px] font-bold uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                  <Shield size={10} /> PRO
                </span>
              )}
            </div>

            {/* Timer Badge & Close */}
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                timeLeft <= 15 
                  ? 'bg-red-500/15 border-red-500/30 text-red-400 animate-pulse' 
                  : 'bg-white/5 border-white/10 text-amber-300'
              }`}>
                <Clock size={12} />
                <span>{timeLeft}s</span>
              </div>
              <button
                onClick={() => setDismissedTaskIds(prev => [...prev, currentTask.id])}
                className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                title="Dismiss Alert"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Service & Client Details */}
          <div className="space-y-1.5 bg-white/5 border border-white/5 rounded-xl p-3">
            <h3 className="text-base font-bold text-white tracking-tight leading-snug line-clamp-2">
              {currentTask.service_name}
            </h3>

            <div className="text-xs text-white/70 space-y-1 pt-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-white/50">Client:</span>
                <span className="font-semibold text-white truncate max-w-[220px]">{clientName}</span>
              </div>

              {jobCode && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white/50">Job Code:</span>
                  <span className="font-mono text-amber-400 font-semibold">{jobCode}</span>
                </div>
              )}

              {salesPerson && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white/50">Sales Assignee:</span>
                  <span className="text-white/90">{salesPerson}</span>
                </div>
              )}

              {currentTask.total_fee > 0 && (
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                  <span className="text-white/50">Total Fee:</span>
                  <span className="font-mono text-emerald-400 font-bold">{Number(currentTask.total_fee).toFixed(3)} OMR</span>
                </div>
              )}
            </div>
          </div>

          {/* Queue Navigation if Multiple Tasks */}
          {visibleTasks.length > 1 && (
            <div className="flex items-center justify-between text-[11px] text-white/50 px-1">
              <span>Offer {currentIndex + 1} of {visibleTasks.length} pending</span>
              <button
                onClick={() => setCurrentIndex((prev) => (prev + 1) % visibleTasks.length)}
                className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-0.5"
              >
                <span>Next offer</span>
                <ChevronRight size={12} />
              </button>
            </div>
          )}

          {/* Action Buttons: Choose / Accept / Decline */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={() => handleDecline(currentTask.id)}
              className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-red-500/10 text-white/70 hover:text-red-400 border border-white/10 hover:border-red-500/20 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
            >
              <span>Pass / Decline</span>
            </button>

            <button
              onClick={() => handleAccept(currentTask.id)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.35)] hover:shadow-[0_0_25px_rgba(245,158,11,0.5)] transition-all flex items-center justify-center gap-1.5"
            >
              <Check size={16} strokeWidth={3} />
              <span>Accept Job</span>
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
