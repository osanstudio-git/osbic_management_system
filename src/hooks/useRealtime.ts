import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useNotificationSound } from './useNotificationSound';

const showBrowserNotification = (title: string, body: string, actionUrl?: string) => {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    const notif = new Notification(title, {
      body,
      icon: "/logo-192.png",
      tag: "osbic-alert",
    });
    if (actionUrl) {
      notif.onclick = () => {
        window.focus();
        const fullUrl = window.location.origin + actionUrl;
        window.location.href = fullUrl;
      };
    }
  }
};

// Live Supabase Realtime Hook — pushes updates to all portals instantly with sound/native alerts
export const useRealtime = (userId: string | undefined) => {
  const queryClient = useQueryClient();
  const { playChime } = useNotificationSound();

  useEffect(() => {
    if (!userId) return;

    // Request notification permission if not asked yet
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const channel = supabase.channel('osbic-pipeline')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` }, (payload) => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          playChime();
          
          const newNotif = payload.new as any;
          if (newNotif) {
            showBrowserNotification(
              newNotif.title_en || 'New Task Assignment',
              newNotif.body_en || 'Open OSBIC Staff portal to view details.',
              newNotif.action_url || '/employee/notifications'
            );
          }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
          queryClient.invalidateQueries({ queryKey: ['job'] });
          queryClient.invalidateQueries({ queryKey: ['employee_jobs_latest_messages'] });
          queryClient.invalidateQueries({ queryKey: ['client_jobs_latest_messages'] });
          queryClient.invalidateQueries({ queryKey: ['admin'] });
          playChime();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_steps' }, () => {
          queryClient.invalidateQueries({ queryKey: ['job'] });
          queryClient.invalidateQueries({ queryKey: ['employee', 'jobs'] });
          queryClient.invalidateQueries({ queryKey: ['client', 'jobs'] });
          queryClient.invalidateQueries({ queryKey: ['admin'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
          queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
          queryClient.invalidateQueries({ queryKey: ['employee', 'jobs'] });
          queryClient.invalidateQueries({ queryKey: ['client', 'jobs'] });
          queryClient.invalidateQueries({ queryKey: ['accounts_overview'] });
          queryClient.invalidateQueries({ queryKey: ['hr_admin_audit'] });
          queryClient.invalidateQueries({ queryKey: ['admin'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_services' }, () => {
          queryClient.invalidateQueries({ queryKey: ['pro_queue'] });
          queryClient.invalidateQueries({ queryKey: ['job'] });
          queryClient.invalidateQueries({ queryKey: ['employee', 'jobs'] });
          queryClient.invalidateQueries({ queryKey: ['client', 'jobs'] });
          queryClient.invalidateQueries({ queryKey: ['accounts_overview'] });
          queryClient.invalidateQueries({ queryKey: ['hr_admin_audit'] });
          queryClient.invalidateQueries({ queryKey: ['admin'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => {
          queryClient.invalidateQueries({ queryKey: ['job'] });
          queryClient.invalidateQueries({ queryKey: ['client', 'documents'] });
          queryClient.invalidateQueries({ queryKey: ['admin'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] });
          queryClient.invalidateQueries({ queryKey: ['admin'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_interactions' }, () => {
          queryClient.invalidateQueries({ queryKey: ['lead_interactions'] });
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          queryClient.invalidateQueries({ queryKey: ['admin'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, () => {
          queryClient.invalidateQueries({ queryKey: ['quotations'] });
          queryClient.invalidateQueries({ queryKey: ['quotation'] });
          queryClient.invalidateQueries({ queryKey: ['admin'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
          queryClient.invalidateQueries({ queryKey: ['invoices'] });
          queryClient.invalidateQueries({ queryKey: ['invoice'] });
          queryClient.invalidateQueries({ queryKey: ['accounts_overview'] });
          queryClient.invalidateQueries({ queryKey: ['admin'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_payments' }, () => {
          queryClient.invalidateQueries({ queryKey: ['pending_payments'] });
          queryClient.invalidateQueries({ queryKey: ['history_payments'] });
          queryClient.invalidateQueries({ queryKey: ['accounts_overview'] });
          queryClient.invalidateQueries({ queryKey: ['hr_admin_audit'] });
          queryClient.invalidateQueries({ queryKey: ['job'] });
          queryClient.invalidateQueries({ queryKey: ['admin'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_expenses' }, () => {
          queryClient.invalidateQueries({ queryKey: ['accounts_overview'] });
          queryClient.invalidateQueries({ queryKey: ['job'] });
          queryClient.invalidateQueries({ queryKey: ['admin'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
          queryClient.invalidateQueries({ queryKey: ['admin'] });
          queryClient.invalidateQueries({ queryKey: ['employee', 'clients'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient, playChime]);
};
