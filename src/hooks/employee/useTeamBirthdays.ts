import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export interface BirthdayCelebrant {
  id: string;
  full_name: string;
  avatar_url: string | null;
  department: string | null;
  gender: 'male' | 'female' | null;
  date_of_birth: string;
  isToday: boolean;
  isUpcomingWeekend?: boolean;
}

export const useTodayBirthdays = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['team-birthdays-today'],
    queryFn: async (): Promise<BirthdayCelebrant[]> => {
      // 1. Fetch active employees with date_of_birth
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, department, gender, date_of_birth, show_birthday_to_team, is_active')
        .eq('role', 'employee')
        .neq('is_active', false)
        .not('date_of_birth', 'is', null);

      if (error) {
        console.warn('Could not query birthdays:', error.message);
        return [];
      }

      const today = new Date();
      const currentMonth = today.getMonth() + 1; // 1-12
      const currentDay = today.getDate(); // 1-31
      const dayOfWeek = today.getDay(); // 0 = Sun, 4 = Thu, 5 = Fri, 6 = Sat

      const celebrants: BirthdayCelebrant[] = [];

      (data || []).forEach((emp: any) => {
        // Exclude if user opted out
        if (emp.show_birthday_to_team === false) return;
        if (!emp.date_of_birth) return;

        const parts = emp.date_of_birth.split('-');
        if (parts.length < 3) return;

        const bMonth = parseInt(parts[1], 10);
        const bDay = parseInt(parts[2], 10);

        // Check exact match today
        if (bMonth === currentMonth && bDay === currentDay) {
          celebrants.push({
            id: emp.id,
            full_name: emp.full_name || 'Team Member',
            avatar_url: emp.avatar_url,
            department: emp.department,
            gender: emp.gender,
            date_of_birth: emp.date_of_birth,
            isToday: true,
          });
        }
        // Weekend proximity check: On Thursday (4), celebrate Friday (5) & Saturday (6) birthdays early
        else if (dayOfWeek === 4) {
          const friday = new Date(today);
          friday.setDate(today.getDate() + 1);
          const saturday = new Date(today);
          saturday.setDate(today.getDate() + 2);

          const isFriday = bMonth === (friday.getMonth() + 1) && bDay === friday.getDate();
          const isSaturday = bMonth === (saturday.getMonth() + 1) && bDay === saturday.getDate();

          if (isFriday || isSaturday) {
            celebrants.push({
              id: emp.id,
              full_name: emp.full_name || 'Team Member',
              avatar_url: emp.avatar_url,
              department: emp.department,
              gender: emp.gender,
              date_of_birth: emp.date_of_birth,
              isToday: false,
              isUpcomingWeekend: true,
            });
          }
        }
      });

      return celebrants;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes cache
    enabled: !!user,
  });
};

export const useSendBirthdayWish = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      celebrantId,
      celebrantName,
      messageEn,
      messageAr,
    }: {
      celebrantId: string;
      celebrantName: string;
      messageEn: string;
      messageAr?: string;
    }) => {
      if (!profile?.id) throw new Error('Not authenticated');

      const senderName = profile.full_name || 'Your Colleague';

      const { error } = await supabase.from('notifications').insert({
        recipient_id: celebrantId,
        sender_id: profile.id,
        type: 'system',
        title_en: `🎉 Birthday Wish from ${senderName}!`,
        title_ar: `🎉 تهنئة بمناسبة يوم ميلادك من ${senderName}!`,
        body_en: messageEn,
        body_ar: messageAr || messageEn,
        is_read: false,
        action_required: false,
        action_url: '/employee',
      } as any);

      if (error) throw error;
      return { celebrantName };
    },
    onSuccess: (data) => {
      toast.success(`Birthday wish sent to ${data.celebrantName}! 🎈`);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to deliver wish');
    },
  });
};
