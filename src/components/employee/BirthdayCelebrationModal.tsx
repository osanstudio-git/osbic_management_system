import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Volume2, VolumeX, X, Heart, Award } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useTranslation } from 'react-i18next';

interface BirthdayCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  avatarUrl?: string | null;
  gender?: 'male' | 'female' | null;
}

// Gentle celebration harmonic melody using Web Audio API
const playCelebrationChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Notes: C4, E4, G4, B4, C5, E5 (ascending pleasant celebratory chime)
    const notes = [261.63, 329.63, 392.00, 493.88, 523.25, 659.25];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);

      gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + idx * 0.12 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.12);
      osc.stop(ctx.currentTime + idx * 0.12 + 0.85);
    });
  } catch (err) {
    console.warn('Audio playback not permitted or unavailable:', err);
  }
};

export const BirthdayCelebrationModal: React.FC<BirthdayCelebrationModalProps> = ({
  isOpen,
  onClose,
  employeeName,
  avatarUrl,
  gender = 'male',
}) => {
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const [isMuted, setIsMuted] = useState(false);
  const audioPlayedRef = useRef(false);

  // Trigger celebration confetti and melody
  const triggerCelebration = () => {
    // 1. Confetti burst
    try {
      confetti({
        particleCount: 80,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#0088cc', '#eab308', '#ec4899', '#10b981', '#ffffff'],
      });

      // Side cannons
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#0088cc', '#eab308', '#38bdf8'],
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#eab308', '#ec4899', '#f59e0b'],
        });
      }, 350);
    } catch (e) {
      // ignore
    }

    // 2. Play gentle celebration sound if not muted
    if (!isMuted) {
      playCelebrationChime();
    }
  };

  useEffect(() => {
    if (isOpen) {
      triggerCelebration();
      audioPlayedRef.current = true;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isFemale = gender === 'female';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="relative w-full max-w-lg bg-gradient-to-b from-[#0f172a] via-[#090d16] to-[#040711] border-2 border-gold/40 rounded-3xl shadow-[0_0_60px_rgba(234,179,8,0.25)] p-6 sm:p-8 text-center text-foreground overflow-hidden z-10"
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          {/* Ambient Lighting Orbs */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-gold/20 rounded-full blur-3xl pointer-events-none" />

          {/* Top Controls */}
          <div className="flex items-center justify-between relative z-10 mb-4">
            <button
              onClick={() => {
                setIsMuted(!isMuted);
                if (isMuted) playCelebrationChime();
              }}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-gold transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
              title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} className="text-gold" />}
              <span className="text-[11px]">{isMuted ? 'Muted' : 'Sound On'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* OSBIC Crest / Ribbon */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs font-bold uppercase tracking-widest shadow-inner">
              <Sparkles size={13} className="animate-spin text-gold" style={{ animationDuration: '4s' }} />
              <span>OSBIC Family Milestone</span>
              <Sparkles size={13} className="animate-spin text-gold" style={{ animationDuration: '4s' }} />
            </div>
          </div>

          {/* Celebrant Photo in Golden Laurel Ring */}
          <div className="relative inline-block mx-auto mb-5">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full p-1.5 bg-gradient-to-tr from-gold via-amber-200 to-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.4)] animate-pulse">
              <div className="w-full h-full rounded-full overflow-hidden bg-slate-900 border-2 border-slate-950 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={employeeName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl sm:text-4xl font-bold font-syne text-gold">
                    {employeeName?.[0]?.toUpperCase() || '★'}
                  </span>
                )}
              </div>
            </div>
            {/* Crown / Celebration Badge */}
            <div className="absolute -top-2 -right-1 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 p-2 rounded-full shadow-lg border border-yellow-200">
              <Award size={18} className="fill-slate-950" />
            </div>
          </div>

          {/* Title & Greeting */}
          <h2 className="text-2xl sm:text-3xl font-syne font-extrabold tracking-tight text-white mb-2">
            {isRtl
              ? `كل عام وأنتِ بألف خير!`
              : `Happy Birthday, ${employeeName.split(' ')[0]}! 🎂`}
          </h2>
          <p className="text-sm font-semibold text-gold tracking-wide uppercase mb-4">
            {isRtl
              ? (isFemale ? `أختنا العزيزة ${employeeName}` : `أخينا العزيز ${employeeName}`)
              : (isFemale ? `Dear Sister ${employeeName}` : `Dear Brother ${employeeName}`)}
          </p>

          {/* Heartfelt Personalized Message */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/10 text-slate-300 text-sm leading-relaxed mb-6 space-y-2">
            {isFemale ? (
              <>
                <p className="text-slate-200 font-medium">
                  {isRtl
                    ? 'نهنئكِ بحلول يوم ميلادكِ المبارك، متمنين لكِ عاماً زاخراً بالصحة والسعادة والنجاحات الباهرة.'
                    : 'On behalf of the entire OSBIC leadership and family, we celebrate you today! Wishing you a year blessed with radiant health, joy, and extraordinary achievements.'}
                </p>
                <p className="text-xs text-muted-foreground/90">
                  {isRtl
                    ? 'فخورون بعطائكِ وتميزكِ المستمر في فريقنا، ونسأل الله لكِ دوام التوفيق والازدهار.'
                    : 'Thank you for bringing your dedication, positive energy, and remarkable value to our team every day!'}
                </p>
              </>
            ) : (
              <>
                <p className="text-slate-200 font-medium">
                  {isRtl
                    ? 'نهنئك بحلول يوم ميلادك المبارك، ونسأل الله لك عاماً حافلاً بالتوفيق والازدهار والهمة العالية.'
                    : 'On behalf of the entire OSBIC leadership and family, we celebrate you today! Wishing you an inspiring year ahead full of victory, prosperity, and continuous growth.'}
                </p>
                <p className="text-xs text-muted-foreground/90">
                  {isRtl
                    ? 'فخورون بجهودك المخلصة وبصمتك المتميزة في نجاحاتنا المستمرة.'
                    : 'Proud of your hard work, leadership, and outstanding dedication to our collective vision!'}
                </p>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={triggerCelebration}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles size={14} className="text-gold" />
              <span>{isRtl ? 'ألعاب نارية 🎉' : 'More Confetti 🎉'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-sm shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Heart size={16} className="fill-slate-950" />
              <span>{isRtl ? 'شكراً لكم! بدء يومي 🚀' : 'Thank You! Start My Day 🚀'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BirthdayCelebrationModal;
