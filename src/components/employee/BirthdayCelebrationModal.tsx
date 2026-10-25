import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, X, Heart } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useTranslation } from 'react-i18next';
import { useAdminSettings } from '../../hooks/admin/useAdminSettings';

interface BirthdayCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  avatarUrl?: string | null;
  gender?: 'male' | 'female' | null;
  department?: string | null;
  role?: string | null;
}

let currentAudioCtx: AudioContext | null = null;

// Classic Happy Birthday musical chime tune using Web Audio API
const playHappyBirthdayTune = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    if (currentAudioCtx && currentAudioCtx.state !== 'closed') {
      currentAudioCtx.close().catch(() => {});
    }
    
    const ctx = new AudioContextClass();
    currentAudioCtx = ctx;

    const C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.00, A4 = 440.00, Bb4 = 466.16, C5 = 523.25;
    
    const melody = [
      // "Happy Birthday to you"
      { note: C4, duration: 0.28 },
      { note: C4, duration: 0.16 },
      { note: D4, duration: 0.42 },
      { note: C4, duration: 0.42 },
      { note: F4, duration: 0.42 },
      { note: E4, duration: 0.82 },

      // "Happy Birthday to you"
      { note: C4, duration: 0.28 },
      { note: C4, duration: 0.16 },
      { note: D4, duration: 0.42 },
      { note: C4, duration: 0.42 },
      { note: G4, duration: 0.42 },
      { note: F4, duration: 0.82 },

      // "Happy Birthday dear [Name]"
      { note: C4, duration: 0.28 },
      { note: C4, duration: 0.16 },
      { note: C5, duration: 0.42 },
      { note: A4, duration: 0.42 },
      { note: F4, duration: 0.38 },
      { note: E4, duration: 0.38 },
      { note: D4, duration: 0.75 },

      // "Happy Birthday to you"
      { note: Bb4, duration: 0.28 },
      { note: Bb4, duration: 0.16 },
      { note: A4, duration: 0.42 },
      { note: F4, duration: 0.42 },
      { note: G4, duration: 0.42 },
      { note: F4, duration: 1.10 },
    ];

    let startTime = ctx.currentTime + 0.05;

    melody.forEach(({ note, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.18, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);

      startTime += duration + 0.02;
    });
  } catch (err) {
    console.warn('Audio playback unavailable:', err);
  }
};

// Spoken personalized greeting: "Happy Birthday, [Name]!"
const speakHappyBirthday = (employeeName: string) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const cleanName = employeeName.trim().split(' ')[0] || employeeName.trim();
    const text = `Happy Birthday, ${cleanName}! Wishing you a wonderful birthday from the OSBIC Family!`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.1;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('David') || v.name.includes('Zira'))
    ) || voices.find(v => v.lang.startsWith('en'));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    // Greet voice right as the music begins
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 900);
  } catch (e) {
    console.warn('Speech synthesis error:', e);
  }
};

export const BirthdayCelebrationModal: React.FC<BirthdayCelebrationModalProps> = ({
  isOpen,
  onClose,
  employeeName,
  avatarUrl,
  gender = 'male',
  department = 'Operations',
}) => {
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const { logo } = useAdminSettings();
  const effectiveLogo = logo || '/logo-192.png';
  const [isMuted, setIsMuted] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

  // Confetti trigger (high zIndex ensures it renders in front of the modal)
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 110,
        spread: 100,
        origin: { y: 0.45 },
        zIndex: 100000,
        colors: ['#0088cc', '#eab308', '#ef4444', '#10b981', '#ffffff', '#38bdf8'],
      });

      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 65,
          origin: { x: 0.1, y: 0.5 },
          zIndex: 100000,
          colors: ['#0088cc', '#eab308', '#38bdf8', '#ffffff'],
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 65,
          origin: { x: 0.9, y: 0.5 },
          zIndex: 100000,
          colors: ['#eab308', '#ef4444', '#f59e0b', '#ffffff'],
        });
      }, 250);
    } catch (e) {
      // ignore
    }
  };

  const handleClose = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (currentAudioCtx && currentAudioCtx.state !== 'closed') {
      currentAudioCtx.close().catch(() => {});
    }
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        triggerConfetti();
      }, 150);

      if (!isMuted) {
        playHappyBirthdayTune();
        speakHappyBirthday(employeeName);
      }

      return () => {
        clearTimeout(timer);
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        if (currentAudioCtx && currentAudioCtx.state !== 'closed') {
          currentAudioCtx.close().catch(() => {});
        }
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
        />

        {/* Outer Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 240 }}
          className="relative w-full max-w-md my-auto z-10 flex flex-col items-center"
        >
          {/* Top Control Bar */}
          <div className="w-full flex items-center justify-between mb-3 px-1 text-white">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isMuted) {
                    setIsMuted(false);
                    playHappyBirthdayTune();
                    speakHappyBirthday(employeeName);
                  } else {
                    setIsMuted(true);
                    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                      window.speechSynthesis.cancel();
                    }
                    if (currentAudioCtx && currentAudioCtx.state !== 'closed') {
                      currentAudioCtx.close().catch(() => {});
                    }
                  }
                }}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-lg active:scale-95"
              >
                {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} className="text-amber-400" />}
                <span className="text-[11px]">{isMuted ? 'Muted' : 'Sound'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all cursor-pointer shadow-lg active:scale-95"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════════
              POSTER CANVAS (EXACT REFERENCE DESIGN WITH OSBIC COLOR THEME)
             ══════════════════════════════════════════════════════════════════════ */}
          <div
            ref={posterRef}
            className="w-full relative rounded-3xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,136,204,0.35)] border border-white/20 select-none"
            style={{
              aspectRatio: '9/16',
              maxHeight: '82vh',
              background: 'linear-gradient(180deg, #09132e 0%, #060c20 50%, #040816 100%)',
            }}
          >
            {/* Background Texture: Vertical Luxury Slat Panels (Lockers / Architectural Slats) */}
            <div className="absolute inset-0 flex justify-between opacity-25 pointer-events-none">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 border-r border-cyan-400/20 last:border-r-0 relative flex flex-col justify-around py-8"
                >
                  <div className="w-1.5 h-6 bg-cyan-400/30 mx-auto rounded-full" />
                  <div className="w-1.5 h-6 bg-cyan-400/30 mx-auto rounded-full" />
                  <div className="w-1.5 h-6 bg-cyan-400/30 mx-auto rounded-full" />
                  <div className="w-1.5 h-6 bg-cyan-400/30 mx-auto rounded-full" />
                </div>
              ))}
            </div>

            {/* Ambient Radial Glows */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-72 bg-[#0088cc]/25 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Poster Inner Container */}
            <div className="relative h-full flex flex-col justify-between p-6 sm:p-7 z-10">
              {/* ── TOP SECTION: LOGOS BADGE & HEADLINE ── */}
              <div className="flex flex-col items-center">
                {/* 1. Official Logos Pill */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white shadow-md border border-slate-200 mb-5">
                  <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center bg-[#0088cc] shadow-sm shrink-0">
                    <img 
                      src={effectiveLogo} 
                      alt="OSBIC" 
                      crossOrigin="anonymous"
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <span className="text-[10px] font-extrabold tracking-widest text-slate-800 uppercase font-sans">
                    OSBIC INTERNATIONAL
                  </span>
                </div>

                {/* 2. "HAPPY" Red/Cyan Angled Banner */}
                <div className="relative z-20 -mb-3 transform -rotate-2">
                  <div className="bg-[#ef4444] text-white px-7 py-1 shadow-lg border border-red-400/50">
                    <span className="text-xl sm:text-2xl font-black tracking-widest uppercase font-sans drop-shadow-sm">
                      HAPPY
                    </span>
                  </div>
                </div>

                {/* 3. "BIRTHDAY" Cream Torn-Paper Cutout Banner */}
                <div
                  className="relative z-10 w-full max-w-[340px] transform rotate-1 drop-shadow-xl"
                  style={{
                    filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.45))',
                  }}
                >
                  <div
                    className="bg-[#fbf7ed] text-[#3e0808] py-2 px-6 text-center"
                    style={{
                      clipPath:
                        'polygon(0% 12%, 4% 0%, 96% 2%, 100% 15%, 97% 88%, 93% 100%, 7% 98%, 0% 86%)',
                    }}
                  >
                    <span
                      className="text-4xl sm:text-5xl font-black tracking-tight uppercase"
                      style={{
                        fontFamily: 'Georgia, "Playfair Display", serif',
                        fontStyle: 'italic',
                        color: '#450a0a',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      Birthday
                    </span>
                  </div>
                </div>
              </div>

              {/* ── CENTER SECTION: PHOTO COLLAGE CUTOUT & STARBURST ── */}
              <div className="relative my-auto flex items-center justify-center py-2">
                {/* Golden Starburst Graphic (Right side of photo) */}
                <div className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 z-0 transform rotate-12 pointer-events-none scale-110 sm:scale-125">
                  <svg width="120" height="120" viewBox="0 0 100 100" className="fill-amber-400 drop-shadow-lg">
                    <polygon points="50,0 62,35 98,20 75,48 100,75 65,70 60,100 45,72 15,90 30,55 0,40 35,32" />
                  </svg>
                </div>

                {/* Torn Paper Photo Cutout */}
                <div
                  className="relative z-10 w-52 h-64 sm:w-60 sm:h-72 p-2.5 bg-[#fbf7ed] shadow-2xl transition-transform"
                  style={{
                    clipPath:
                      'polygon(8% 0%, 93% 5%, 100% 20%, 97% 85%, 92% 100%, 5% 96%, 0% 80%, 3% 15%)',
                    filter: 'drop-shadow(0 15px 25px rgba(0,0,0,0.6))',
                  }}
                >
                  <div
                    className="w-full h-full overflow-hidden bg-slate-900"
                    style={{
                      clipPath:
                        'polygon(7% 2%, 91% 6%, 98% 21%, 95% 84%, 90% 98%, 6% 94%, 2% 78%, 5% 16%)',
                    }}
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={employeeName}
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-[#0088cc] to-[#040816] text-white">
                        <span className="text-6xl font-bold font-syne">{firstName[0]}</span>
                        <span className="text-xs font-semibold tracking-wider text-amber-300 mt-2">
                          OSBIC SPECIALIST
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Double Paper Stickers for Name & Position (Bottom-Left) */}
                <div className="absolute left-3 sm:left-6 bottom-4 z-20 flex flex-col gap-1.5 pointer-events-none">
                  {/* Name Sticker */}
                  <div
                    className="bg-[#fbf7ed] text-[#0f172a] px-3.5 py-1 text-sm sm:text-base font-extrabold uppercase font-sans tracking-wide shadow-md transform -rotate-3"
                    style={{
                      boxShadow: '2px 4px 10px rgba(0,0,0,0.3)',
                    }}
                  >
                    {employeeName.trim()}
                  </div>

                  {/* Position Sticker (Small text) */}
                  <div
                    className="bg-[#fbf7ed] text-[#0f172a] px-2.5 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase font-sans tracking-wider shadow-md transform rotate-2 -mt-1 ml-2"
                    style={{
                      boxShadow: '2px 4px 10px rgba(0,0,0,0.3)',
                    }}
                  >
                    Business Consultant
                  </div>
                </div>
              </div>

              {/* ── BOTTOM SECTION: WISHES, DATE & ROLE ── */}
              <div className="flex flex-col gap-4 pt-2">
                <div className="grid grid-cols-12 gap-3 items-end">
                  {/* Left Column: Heartfelt Wish */}
                  <div className="col-span-8 text-left">
                    <p className="text-[10.5px] sm:text-xs text-white/90 leading-relaxed font-sans font-normal drop-shadow-sm">
                      Wishing you all the happiness in the world today and always. May this new chapter
                      bring you exciting opportunities, unforgettable milestones, and endless reasons to
                      smile. You deserve all the good things life has to offer. Have a truly amazing birthday!
                    </p>
                  </div>

                  {/* Right Column: OSBIC Family */}
                  <div className="col-span-4 flex flex-col items-end justify-end text-right">
                    <div className="bg-white text-slate-900 px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider shadow-md">
                      OSBIC FAMILY
                    </div>
                  </div>
                </div>

                {/* Footer Tag with Website & Line */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="bg-[#ef4444] text-white text-[10px] font-extrabold px-3 py-0.5 rounded-md tracking-wider lowercase">
                    www.osbic.net
                  </div>
                  <div className="flex-1 h-[2px] bg-red-500/80 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action: Done Button */}
          <button
            type="button"
            onClick={handleClose}
            className="mt-4 px-8 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs tracking-wider uppercase backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-lg active:scale-95 flex items-center gap-2"
          >
            <Heart size={14} className="fill-red-500 text-red-500" />
            <span>Thank You! Start My Day 🚀</span>
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BirthdayCelebrationModal;
