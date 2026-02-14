import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Bell, 
  History, 
  FileText, 
  X, 
  ShieldCheck, 
  Languages,
  ChevronRight,
  Zap,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { Button } from './Common';

type Language = 'en' | 'es';
type ViewMode = 'A' | 'B';

interface PaywallProps {
  onClose: () => void;
  onSubscribe: () => void;
}

export const Paywall: React.FC<PaywallProps> = ({ onClose, onSubscribe }) => {
  const [lang, setLang] = useState<Language>('en');
  const [mode, setMode] = useState<ViewMode>('B');

  const content = {
    en: {
      A: {
        title: "Get ClearCase Plus",
        subtitle: "See the key dates and what to prepare next.",
        cta: "Try Plus for $9.99/mo",
        features: [
          { title: "Deadline Reminders", desc: "Never miss an important date.", icon: Bell, color: "bg-blue-50 text-blue-600" },
          { title: "Case Memory", desc: "Keep unlimited history of documents.", icon: History, color: "bg-emerald-50 text-emerald-600" },
          { title: "Plain Summaries", desc: "Summaries ready to share with lawyers.", icon: FileText, color: "bg-purple-50 text-purple-600" }
        ]
      },
      B: {
        title: "Upgrade your Clarity",
        subtitle: "Unlock professional features for your legal journey.",
        cta: "Activate Plus Access",
        features: [
          { title: "Unlimited Analysis", desc: "No more limits on document uploads.", icon: Zap, color: "bg-amber-50 text-amber-600" },
          { title: "Automatic Alerts", desc: "Push alerts for upcoming response windows.", icon: Bell, color: "bg-rose-50 text-rose-600" },
          { title: "One-Tap Packets", desc: "Generate evidence lists with one tap.", icon: CheckCircle2, color: "bg-blue-50 text-blue-600" }
        ]
      },
      trust: "ClearCase provides legal clarity, not legal advice.",
      notNow: "Not now"
    },
    es: {
      A: {
        title: "Obtenga ClearCase Plus",
        subtitle: "Vea las fechas clave y qué preparar a continuación.",
        cta: "Pruebe Plus por $9.99/mes",
        features: [
          { title: "Recordatorios de Plazos", desc: "Nunca pierda una fecha importante.", icon: Bell, color: "bg-blue-50 text-blue-600" },
          { title: "Memoria del Caso", desc: "Historial ilimitado de documentos.", icon: History, color: "bg-emerald-50 text-emerald-600" },
          { title: "Resúmenes Sencillos", desc: "Resúmenes listos para compartir.", icon: FileText, color: "bg-purple-50 text-purple-600" }
        ]
      },
      B: {
        title: "Mejore su Claridad",
        subtitle: "Desbloquee funciones para su camino legal.",
        cta: "Activar Acceso Plus",
        features: [
          { title: "Análisis Ilimitado", desc: "Sin límites en la carga de documentos.", icon: Zap, color: "bg-amber-50 text-amber-600" },
          { title: "Alertas Automáticas", desc: "Alertas para ventanas de respuesta.", icon: Bell, color: "bg-rose-50 text-rose-600" },
          { title: "Paquetes Rápidos", desc: "Listas de pruebas con un solo toque.", icon: CheckCircle2, color: "bg-blue-50 text-blue-600" }
        ]
      },
      trust: "ClearCase brinda claridad legal, no asesoramiento legal.",
      notNow: "Ahora no"
    }
  };

  const t = content[lang];
  const active = t[mode];

  return (
    <div className="flex flex-col h-full bg-white font-sans text-slate-900 overflow-hidden relative">
      {/* Dev Toggle */}
      <div className="absolute top-0 inset-x-0 z-50 bg-slate-900/10 backdrop-blur-md p-2 flex items-center justify-between text-[10px] font-bold text-slate-600">
        <div className="flex gap-2">
          <button onClick={() => setMode('A')} className={`px-2 py-1 rounded ${mode === 'A' ? 'bg-white shadow-sm' : ''}`}>Option A</button>
          <button onClick={() => setMode('B')} className={`px-2 py-1 rounded ${mode === 'B' ? 'bg-white shadow-sm' : ''}`}>Option B</button>
        </div>
        <button onClick={() => setLang(l => l === 'en' ? 'es' : 'en')} className="flex items-center gap-1.5 px-2 py-1 bg-white/50 rounded-full">
          <Languages size={12} />
          {lang.toUpperCase()}
        </button>
      </div>

      <div className="px-8 pt-16 pb-6 flex justify-end">
        <button onClick={onClose} className="p-3 bg-slate-50 rounded-2xl text-slate-400 active:scale-90 transition-all">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4 space-y-12 custom-scrollbar">
        <div className="text-center">
          <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-sm">
            <Sparkles size={40} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">{active.title}</h1>
          <p className="text-slate-500 text-[16px] max-w-[260px] mx-auto leading-relaxed">{active.subtitle}</p>
        </div>

        <div className="space-y-8">
          {active.features.map((f, i) => (
            <div key={i} className="flex gap-6 items-start">
              <div className={`w-14 h-14 shrink-0 rounded-[24px] ${f.color} flex items-center justify-center shadow-sm`}>
                <f.icon size={24} strokeWidth={2} />
              </div>
              <div className="flex-1 pt-1">
                <h3 className="text-[16px] font-bold text-slate-900 mb-1">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-snug">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-slate-50 rounded-[32px] p-6 flex items-start gap-4 border border-slate-100">
          <ShieldCheck size={20} className="text-slate-400 shrink-0 mt-0.5" />
          <p className="text-[12px] font-medium text-slate-500 leading-relaxed italic">
            "{t.trust}"
          </p>
        </div>
      </div>

      <div className="p-10 pt-6 border-t border-slate-50 bg-white">
        <Button 
          onClick={onSubscribe}
          className="w-full !py-5 !bg-amber-500 !text-white !rounded-[24px] !text-[15px] !font-black flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 active:scale-95 transition-all"
        >
          {active.cta}
          <ChevronRight size={20} />
        </Button>
        <button 
          onClick={onClose}
          className="w-full py-4 text-[12px] font-bold uppercase tracking-widest text-slate-400 mt-2"
        >
          {t.notNow}
        </button>
      </div>
    </div>
  );
};
