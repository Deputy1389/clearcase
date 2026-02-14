import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  ShieldCheck, 
  Languages, 
  Calendar, 
  FileText, 
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Button } from './Common';

interface OnboardingProps {
  onComplete: () => void;
  onSubscribe: () => void;
}

type ViewMode = 'A' | 'B';
type Language = 'en' | 'es';

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onSubscribe }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [lang, setLang] = useState<Language>('en');
  const [mode, setMode] = useState<ViewMode>('B');

  const content = {
    en: {
      A: [
        {
          title: "Legal documents, simplified.",
          desc: "Understand notices and contracts in plain English.",
          icon: FileText,
          color: "bg-slate-50 text-slate-900"
        },
        {
          title: "Know your deadlines.",
          desc: "We find the dates that matter so you don't miss them.",
          icon: Clock,
          color: "bg-blue-50 text-blue-600"
        },
        {
          title: "Ready to get clarity?",
          desc: "Choose how you want to start your journey.",
          icon: Sparkles,
          color: "bg-amber-50 text-amber-500"
        }
      ],
      B: [
        {
          title: "Stop the legal stress.",
          desc: "See the plain meaning of any document in seconds.",
          bullets: ["No legal jargon", "Clear summaries", "Fast analysis"],
          icon: ShieldCheck,
          color: "bg-emerald-50 text-emerald-600"
        },
        {
          title: "Focus on what matters.",
          desc: "We highlight the next 3 steps you should consider.",
          bullets: ["Actionable checklists", "Key date tracking", "Evidence lists"],
          icon: CheckCircle2,
          color: "bg-blue-50 text-blue-600"
        },
        {
          title: "Power up your cases.",
          desc: "Plus gives you unlimited history and deadline alerts.",
          bullets: ["Never miss a date", "Expanded storage", "Share with lawyers"],
          icon: Sparkles,
          color: "bg-amber-50 text-amber-500"
        }
      ],
      common: {
        skip: "Skip",
        back: "Back",
        next: "Next",
        continueFree: "Continue Free",
        startPlus: "Start Plus",
        disclaimer: "ClearCase provides clarity, not legal advice."
      }
    },
    es: {
      A: [
        {
          title: "Documentos legales, simplificados.",
          desc: "Entienda avisos y contratos en lenguaje sencillo.",
          icon: FileText,
          color: "bg-slate-50 text-slate-900"
        },
        {
          title: "Conozca sus plazos.",
          desc: "Buscamos las fechas importantes para que no las pierda.",
          icon: Clock,
          color: "bg-blue-50 text-blue-600"
        },
        {
          title: "¿Listo para tener claridad?",
          desc: "Elija cómo desea comenzar su camino.",
          icon: Sparkles,
          color: "bg-amber-50 text-amber-500"
        }
      ],
      B: [
        {
          title: "Detenga el estrés legal.",
          desc: "Vea el significado de cualquier documento en segundos.",
          bullets: ["Sin lenguaje técnico", "Resúmenes claros", "Análisis rápido"],
          icon: ShieldCheck,
          color: "bg-emerald-50 text-emerald-600"
        },
        {
          title: "Enfóquese en lo importante.",
          desc: "Resaltamos los siguientes 3 pasos a considerar.",
          bullets: ["Listas de acción", "Seguimiento de fechas", "Listas de pruebas"],
          icon: CheckCircle2,
          color: "bg-blue-50 text-blue-600"
        },
        {
          title: "Potencie sus casos.",
          desc: "Plus le ofrece historial ilimitado y alertas de plazos.",
          bullets: ["No pierda fechas", "Almacenamiento expandido", "Comparta con abogados"],
          icon: Sparkles,
          color: "bg-amber-50 text-amber-500"
        }
      ],
      common: {
        skip: "Saltar",
        back: "Atrás",
        next: "Siguiente",
        continueFree: "Continuar Gratis",
        startPlus: "Iniciar Plus",
        disclaimer: "ClearCase brinda claridad, no asesoramiento legal."
      }
    }
  };

  const t = content[lang];
  const slides = t[mode];
  const slide = slides[currentSlide];
  const isLast = currentSlide === slides.length - 1;

  return (
    <div className="flex flex-col h-full bg-white relative overflow-hidden">
      {/* Dev Controls */}
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

      <div className="pt-16 px-8 flex justify-between items-center">
        {currentSlide > 0 ? (
          <button onClick={() => setCurrentSlide(s => s - 1)} className="text-slate-400 font-bold text-[10px] uppercase tracking-widest flex items-center gap-1">
            <ArrowLeft size={14} /> {t.common.back}
          </button>
        ) : <div />}
        {!isLast && (
          <button onClick={onComplete} className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">
            {t.common.skip}
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-10 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={mode + currentSlide + lang}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.05, y: -10 }}
            className="w-full flex flex-col items-center"
          >
            <div className={`w-24 h-24 rounded-[32px] ${slide.color} flex items-center justify-center mb-10 shadow-sm`}>
              <slide.icon size={40} strokeWidth={1.5} />
            </div>

            <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight leading-tight">
              {slide.title}
            </h2>

            <p className="text-slate-500 leading-relaxed text-[16px] mb-8 max-w-[280px]">
              {slide.desc}
            </p>

            {slide.bullets && (
              <div className="w-full max-w-[240px] space-y-3 mb-4 text-left">
                {slide.bullets.map((b, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-900/10" />
                    <span className="text-sm font-medium text-slate-600">{b}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="p-10 pb-12 flex flex-col items-center gap-6">
        {isLast ? (
          <div className="w-full space-y-4">
            <Button 
              onClick={onSubscribe}
              className="w-full !py-5 !bg-amber-500 !text-white !rounded-[24px] !text-[14px] !font-black flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 active:scale-95 transition-all"
            >
              <Sparkles size={18} />
              {t.common.startPlus}
            </Button>
            <button 
              onClick={onComplete}
              className="w-full text-slate-400 font-bold text-[12px] uppercase tracking-widest"
            >
              {t.common.continueFree}
            </button>
          </div>
        ) : (
          <div className="w-full flex items-center justify-between">
            <div className="flex gap-2">
              {slides.map((_, i) => (
                <div 
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentSlide ? 'w-8 bg-slate-900' : 'w-1.5 bg-slate-200'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => setCurrentSlide(s => s + 1)}
              className="w-14 h-14 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg active:scale-90 transition-all"
            >
              <ArrowRight size={20} />
            </button>
          </div>
        )}
        
        <p className="text-[10px] text-slate-400 italic font-medium px-4 text-center leading-relaxed">
          "{t.common.disclaimer}"
        </p>
      </div>
    </div>
  );
};
