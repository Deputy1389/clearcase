import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  X, 
  Lock, 
  ShieldAlert,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { Button } from './Common';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  lang?: 'en' | 'es';
}

export const LimitModal: React.FC<ModalProps> = ({ isOpen, onClose, onUpgrade, lang = 'en' }) => {
  const content = {
    en: {
      title: "Case limit reached",
      subtitle: "You've used all your free slots. Upgrade to Plus for unlimited document history.",
      cta: "See Plus Plans",
      cancel: "Maybe later"
    },
    es: {
      title: "Límite alcanzado",
      subtitle: "Ha usado todos sus espacios gratuitos. Mejore a Plus para un historial ilimitado.",
      cta: "Ver planes Plus",
      cancel: "En otro momento"
    }
  };

  const t = content[lang];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            className="relative w-full max-w-sm bg-white rounded-[40px] p-10 text-center shadow-2xl"
          >
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-sm">
              <ShieldAlert size={36} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">{t.title}</h2>
            <p className="text-slate-500 text-[15px] leading-relaxed mb-10 px-4">{t.subtitle}</p>
            
            <div className="space-y-4">
              <Button 
                onClick={onUpgrade}
                className="w-full !py-5 !bg-slate-900 !text-white !rounded-[24px] !text-[14px] !font-black flex items-center justify-center gap-2 shadow-xl shadow-slate-900/10 active:scale-95 transition-all"
              >
                <Sparkles size={18} className="text-amber-400" />
                {t.cta}
              </Button>
              <button 
                onClick={onClose}
                className="w-full py-2 text-[12px] font-bold uppercase tracking-widest text-slate-400"
              >
                {t.cancel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const LockModal: React.FC<ModalProps & { feature?: 'reminders' | 'history' }> = ({ isOpen, onClose, onUpgrade, lang = 'en', feature = 'reminders' }) => {
  const content = {
    en: {
      reminders: {
        title: "Deadline Alerts",
        subtitle: "Never miss a response window. Plus gives you automated alerts for key dates.",
      },
      history: {
        title: "Case History",
        subtitle: "Keep a permanent record of all your legal documents in one secure place.",
      },
      cta: "Unlock with Plus",
      cancel: "Not now"
    },
    es: {
      reminders: {
        title: "Alertas de Plazos",
        subtitle: "Nunca pierda una respuesta. Plus le ofrece alertas automáticas para fechas clave.",
      },
      history: {
        title: "Historial de Casos",
        subtitle: "Mantenga un registro permanente de sus documentos en un solo lugar seguro.",
      },
      cta: "Desbloquear con Plus",
      cancel: "Ahora no"
    }
  };

  const t = content[lang];
  const f = t[feature as keyof typeof t] as { title: string, subtitle: string };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            className="relative w-full max-w-sm bg-white rounded-[40px] p-10 text-center shadow-2xl"
          >
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-sm">
              <Lock size={36} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">{f.title}</h2>
            <p className="text-slate-500 text-[15px] leading-relaxed mb-10 px-4">{f.subtitle}</p>
            
            <div className="space-y-4">
              <Button 
                onClick={onUpgrade}
                className="w-full !py-5 !bg-blue-600 !text-white !rounded-[24px] !text-[14px] !font-black flex items-center justify-center gap-2 shadow-xl shadow-blue-600/10 active:scale-95 transition-all"
              >
                <Sparkles size={18} className="text-blue-200" />
                {t.cta}
              </Button>
              <button 
                onClick={onClose}
                className="w-full py-2 text-[12px] font-bold uppercase tracking-widest text-slate-400"
              >
                {t.cancel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
