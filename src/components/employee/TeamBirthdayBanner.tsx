import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cake, Sparkles, Send, X, Check, Heart, MessageSquareHeart } from 'lucide-react';
import { useTodayBirthdays, useSendBirthdayWish, type BirthdayCelebrant } from '../../hooks/employee/useTeamBirthdays';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

export const TeamBirthdayBanner: React.FC = () => {
  const { profile } = useAuth();
  const { data: celebrants = [], isLoading } = useTodayBirthdays();
  const { mutate: sendWish, isPending: isSending } = useSendBirthdayWish();
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  const [activeModalCelebrant, setActiveModalCelebrant] = useState<BirthdayCelebrant | null>(null);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [customNote, setCustomNote] = useState('');
  const [sentCelebrants, setSentCelebrants] = useState<Record<string, boolean>>({});

  // Filter out current user from team list (they already get their own personal popup modal)
  const otherCelebrants = celebrants.filter((c) => c.id !== profile?.id);

  if (isLoading || otherCelebrants.length === 0) {
    return null;
  }

  const presetWishes = [
    {
      en: 'Wishing you a joyful birthday, vibrant health, and extraordinary success this year! 🎂',
      ar: 'كل عام وأنت بألف خير وعافية، متمنياً لك عاماً زاخراً بالنجاح والتوفيق والسعادة! 🎂',
    },
    {
      en: 'Happy Birthday champion! Proud to work alongside such a dedicated colleague! 🚀',
      ar: 'يوم ميلاد سعيد يا بطل! فخور بالعمل إلى جانب زميل رائع ومخلص مثلك! 🚀',
    },
    {
      en: 'May your special day bring you as much happiness as the positive energy you bring to OSBIC! 🌟',
      ar: 'أتمنى لك يوماً سعيداً بقدر الطاقة الإيجابية والتميز الذي تضيفه لعائلة أوسبك! 🌟',
    },
  ];

  const handleSendWish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalCelebrant) return;

    const messageEn = customNote.trim() || presetWishes[selectedPresetIndex].en;
    const messageAr = customNote.trim() || presetWishes[selectedPresetIndex].ar;

    sendWish(
      {
        celebrantId: activeModalCelebrant.id,
        celebrantName: activeModalCelebrant.full_name,
        messageEn,
        messageAr,
      },
      {
        onSuccess: () => {
          setSentCelebrants((prev) => ({ ...prev, [activeModalCelebrant.id]: true }));
          setActiveModalCelebrant(null);
          setCustomNote('');
        },
      }
    );
  };

  return (
    <>
      <div className="w-full mb-6">
        {otherCelebrants.map((celebrant) => {
          const alreadySent = sentCelebrants[celebrant.id];
          const isFemale = celebrant.gender === 'female';

          return (
            <motion.div
              key={celebrant.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-primary/10 border border-amber-500/30 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              {/* Background celebration accents */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                {/* Left: Avatar & Info */}
                <div className="flex items-center gap-3.5">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 p-0.5 shadow-md">
                      <div className="w-full h-full rounded-[10px] overflow-hidden bg-slate-900 flex items-center justify-center">
                        {celebrant.avatarUrl ? (
                          <img
                            src={celebrant.avatarUrl}
                            alt={celebrant.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="font-bold text-lg text-gold">
                            {celebrant.full_name?.[0]?.toUpperCase() || '★'}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="absolute -bottom-1 -right-1 text-xs">🎉</span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-syne font-bold text-foreground text-sm sm:text-base">
                        {celebrant.full_name}
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/30 font-semibold uppercase tracking-wider">
                        {celebrant.department || 'OSBIC Team'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <Cake size={13} className="text-gold" />
                      <span>
                        {celebrant.isToday
                          ? isRtl
                            ? `يحتفل اليوم ${isFemale ? 'أختنا' : 'أخينا'} بيوم ميلاده! شاركه أجمل التهاني 🎈`
                            : `Is celebrating their birthday today! Share a warm wish 🎈`
                          : isRtl
                            ? `يحتفل بيوم ميلاده في عطلة نهاية هذا الأسبوع! بادر بتهنئته 🌟`
                            : `Is celebrating their birthday this weekend! Send an early wish 🌟`}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Right: Action */}
                <div className="w-full sm:w-auto flex items-center justify-end">
                  {alreadySent ? (
                    <div className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                      <Check size={14} />
                      <span>{isRtl ? 'تم إرسال التهنئة ✓' : 'Wish Sent ✓'}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveModalCelebrant(celebrant)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                      <MessageSquareHeart size={15} className="fill-slate-950" />
                      <span>{isRtl ? 'إرسال تهنئة 🎈' : 'Send Wish 🎈'}</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Wish Modal */}
      <AnimatePresence>
        {activeModalCelebrant && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveModalCelebrant(null)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              className="relative w-full max-w-md bg-[#0d1424] border border-amber-500/30 rounded-2xl p-6 shadow-2xl z-10 text-foreground"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div className="flex items-center gap-2 text-gold">
                  <Heart size={18} className="fill-gold" />
                  <h3 className="font-syne font-bold text-base">
                    {isRtl
                      ? `تهنئة الزميل ${activeModalCelebrant.full_name}`
                      : `Wish ${activeModalCelebrant.full_name} Happy Birthday!`}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveModalCelebrant(null)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSendWish} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    {isRtl ? 'اختر رسالة جاهزة:' : 'Choose a preset wish:'}
                  </label>
                  <div className="space-y-2">
                    {presetWishes.map((wish, index) => {
                      const text = isRtl ? wish.ar : wish.en;
                      const isSelected = selectedPresetIndex === index && !customNote;

                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setSelectedPresetIndex(index);
                            setCustomNote('');
                          }}
                          className={`w-full text-start p-3 rounded-xl border text-xs leading-relaxed transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-gold/15 border-gold text-white font-medium shadow-sm'
                              : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10'
                          }`}
                        >
                          {text}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    {isRtl ? 'أو اكتب رسالة مخصصة (اختياري):' : 'Or write your own note (optional):'}
                  </label>
                  <textarea
                    rows={2}
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder={
                      isRtl
                        ? 'اكتب رسالة خاصة تسعد قلب زميلك...'
                        : 'Write a personalized note for your teammate...'
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold transition-colors resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveModalCelebrant(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-white transition-colors"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSending}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send size={13} className="fill-slate-950" />
                    <span>{isSending ? (isRtl ? 'جار الإرسال...' : 'Sending...') : (isRtl ? 'إرسال التهنئة 🚀' : 'Send Wish 🚀')}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default TeamBirthdayBanner;
