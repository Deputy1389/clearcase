import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Calendar, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  ExternalLink, 
  ChevronDown, 
  ChevronLeft,
  Info,
  Bell,
  Languages,
  ListTodo,
  AlertCircle,
  Loader2,
  Archive,
  History,
  Scale,
  PenTool,
  HelpingHand,
  Check
} from 'lucide-react';
import { Card, Button, StatusChip } from './Common';
import { DraftingAssistant } from './DraftingAssistant';
import { LegalAid } from './LegalAid';

interface WorkspaceV2Props {
  onBack: () => void;
  caseData?: any;
}

type ViewMode = 'A' | 'B' | 'C';
type Language = 'en' | 'es';
type AppState = 'default' | 'urgent' | 'processing';
type ActiveOverlay = 'none' | 'drafting' | 'legalaid';

export const Workspace: React.FC<WorkspaceV2Props> = ({ onBack }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('B');
  const [language, setLanguage] = useState<Language>('en');
  const [appState, setAppState] = useState<AppState>('default');
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>('none');
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const toggleStep = (index: number) => {
    setCompletedSteps(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  // Translations and Content
  const content = {
    en: {
      header: "Case Summary",
      whatIsThis: "What is this?",
      nextDate: "Next important date",
      nextSteps: "Next 3 steps",
      toGather: "Cosas que preparar", // Wait, this is EN object. Fixed below.
      howSure: "How sure we are this is correct",
      details: "Details & receipts",
      viewDoc: "View original",
      getReminders: "Get reminders",
      shareLawyer: "Share with lawyer",
      processing: "Analyzing your document...",
      back: "Back",
      daysLeft: (days: number) => `in ${days} days`,
      summary: "This is a notice from your landlord about a rent increase starting next month.",
      steps: [
        "Check your current lease for notice rules",
        "Call your landlord to talk about the new price",
        "Save a copy of this notice for your records"
      ],
      gather: [
        "Your current lease agreement",
        "Receipts for last 3 months of rent",
        "Any letters from your landlord",
        "Photos of the property if needed"
      ]
    },
    es: {
      header: "Resumen del caso",
      whatIsThis: "¿Qué es esto?",
      nextDate: "Próxima fecha importante",
      nextSteps: "Siguientes 3 pasos",
      toGather: "Cosas que preparar",
      howSure: "Qué tan seguros estamos de que esto es correcto",
      details: "Detalles y recibos",
      viewDoc: "Ver original",
      getReminders: "Recibir recordatorios",
      shareLawyer: "Compartir con abogado",
      processing: "Analizando su documento...",
      back: "Volver",
      daysLeft: (days: number) => `dentro de ${days} días`,
      summary: "Este es un aviso de su propietario sobre un aumento de renta que comienza el próximo mes.",
      steps: [
        "Revise las reglas de aviso en su contrato actual",
        "Muchas personas optan por llamar al propietario para hablar del precio",
        "Guarde una copia de este aviso para sus registros"
      ],
      gather: [
        "Su contrato de arrendamiento actual",
        "Recibos de los últimos 3 meses de renta",
        "Cualquier carta de su propietario",
        "Fotos de la propiedad si es necesario"
      ]
    }
  };

  const t = content[language];

  // UI Components for Different Sections
  const SummaryCard = () => (
    <Card className={`border-none ${viewMode === 'A' ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' : 'bg-white border border-slate-100 shadow-sm'}`}>
      <div className="flex items-center gap-2 mb-3">
        <Info size={16} className={viewMode === 'A' ? 'text-blue-400' : 'text-blue-600'} />
        <span className={`text-[10px] font-bold uppercase tracking-widest ${viewMode === 'A' ? 'text-white/50' : 'text-slate-400'}`}>
          {t.whatIsThis}
        </span>
      </div>
      <p className={`text-lg font-medium leading-snug ${viewMode === 'A' ? 'text-white' : 'text-slate-900'}`}>
        {t.summary}
      </p>
      <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
        <span className={`text-[10px] uppercase tracking-wider ${viewMode === 'A' ? 'text-white/40' : 'text-slate-400'}`}>
          {t.howSure}
        </span>
        <span className={`text-xs font-bold ${viewMode === 'A' ? 'text-emerald-400' : 'text-emerald-600'}`}>98%</span>
      </div>
    </Card>
  );

  const DateCard = () => (
    <Card className={`border-none ${appState === 'urgent' ? 'bg-rose-50 border border-rose-100' : 'bg-slate-50 border border-slate-100'}`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <Calendar size={18} className={appState === 'urgent' ? 'text-rose-600' : 'text-slate-600'} />
          <span className={`text-[10px] font-bold uppercase tracking-widest ${appState === 'urgent' ? 'text-rose-900/40' : 'text-slate-400'}`}>
            {t.nextDate}
          </span>
        </div>
        {appState === 'urgent' && <div className="bg-rose-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Reply Needed</div>}
      </div>
      <div className="flex items-baseline gap-3">
        <span className={`text-2xl font-black ${appState === 'urgent' ? 'text-rose-900' : 'text-slate-900'}`}>Nov 14</span>
        <span className={`text-sm font-medium ${appState === 'urgent' ? 'text-rose-600' : 'text-slate-500'}`}>
          ({t.daysLeft(12)})
        </span>
      </div>
    </Card>
  );

  const StepsCard = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <ListTodo size={16} className="text-slate-400" />
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.nextSteps}</h3>
        </div>
        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
          {completedSteps.length}/{t.steps.length} Done
        </span>
      </div>
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        {t.steps.map((step, i) => {
          const isDone = completedSteps.includes(i);
          return (
            <button 
              key={i} 
              onClick={() => toggleStep(i)}
              className={`w-full flex items-start gap-4 p-5 text-left transition-colors hover:bg-slate-50/50 ${i !== t.steps.length - 1 ? 'border-b border-slate-50' : ''}`}
            >
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all duration-300 ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200'}`}>
                {isDone ? <Check size={12} strokeWidth={4} /> : (viewMode === 'B' ? <span className="text-[10px] font-bold">{i+1}</span> : <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />)}
              </div>
              <p className={`text-[14px] font-medium leading-tight transition-all duration-300 ${isDone ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{step}</p>
            </button>
          );
        })}
      </div>
    </div>
  );

  const GatherCard = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-2">
        <Archive size={16} className="text-slate-400" />
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.toGather}</h3>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {t.gather.map((item, i) => (
          <div key={i} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <span className="text-xs font-medium text-slate-600">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // Layout Rendering
  return (
    <div className="flex flex-col h-full bg-white font-sans text-slate-900 overflow-hidden">
      {/* Dev Controls - Fixed at Top */}
      <div className="bg-slate-900 p-2 flex items-center justify-between text-[10px] text-white/50 font-bold overflow-x-auto whitespace-nowrap gap-4">
        <div className="flex gap-2">
          {['A', 'B', 'C'].map(m => (
            <button key={m} onClick={() => setViewMode(m as ViewMode)} className={`px-2 py-1 rounded ${viewMode === m ? 'bg-white text-slate-900' : 'bg-white/10'}`}>
              Style {m}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {['default', 'urgent', 'processing'].map(s => (
            <button key={s} onClick={() => setAppState(s as AppState)} className={`px-2 py-1 rounded capitalize ${appState === s ? 'bg-blue-500 text-white' : 'bg-white/10'}`}>
              {s}
            </button>
          ))}
        </div>
        <button onClick={() => setLanguage(l => l === 'en' ? 'es' : 'en')} className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/10">
          <Languages size={12} />
          {language.toUpperCase()}
        </button>
      </div>

      {/* App Header */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-slate-50">
        <button onClick={onBack} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 active:scale-90 transition-all">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-sm font-bold uppercase tracking-widest text-slate-400">{t.header}</h1>
        <button className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
          <Bell size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 custom-scrollbar">
        {appState === 'processing' ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-8">
            <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-500 mb-6 animate-pulse">
              <Loader2 size={32} className="animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">{t.processing}</h2>
            <p className="text-slate-400 text-sm">This usually takes about 10 seconds.</p>
          </div>
        ) : (
          <>
            <AnimatePresence mode="wait">
              <motion.div 
                key={viewMode + language}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                {/* Visual Direction A: Ultra-minimal focus */}
                {viewMode === 'A' && (
                  <>
                    <SummaryCard />
                    <DateCard />
                    <StepsCard />
                  </>
                )}

                {/* Visual Direction B: Guided Checklist focus */}
                {viewMode === 'B' && (
                  <>
                    <div className="bg-blue-600 rounded-[32px] p-8 text-white shadow-xl shadow-blue-100">
                      <div className="flex items-center gap-2 mb-4">
                        <Scale size={20} className="text-blue-200" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200">Legal Clarity</span>
                      </div>
                      <h2 className="text-2xl font-bold mb-4">{t.summary}</h2>
                      <div className="bg-white/10 rounded-2xl p-4 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                           <Calendar size={16} className="text-blue-200" />
                           <span className="text-sm font-bold">Reply by Nov 14</span>
                         </div>
                         <ArrowRight size={16} className="text-blue-200" />
                      </div>
                    </div>
                    <StepsCard />
                  </>
                )}

                {/* Visual Direction C: Timeline focus */}
                {viewMode === 'C' && (
                  <>
                    <SummaryCard />
                    <div className="space-y-6 pl-4 border-l-2 border-slate-100 ml-2 py-2">
                       <div className="relative">
                          <div className="absolute -left-[1.35rem] top-1 w-4 h-4 rounded-full bg-blue-600 ring-4 ring-blue-50" />
                          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                             <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Today's Focus</p>
                             <h4 className="font-bold text-slate-900">{t.steps[0]}</h4>
                          </div>
                       </div>
                       <div className="relative opacity-60">
                          <div className="absolute -left-[1.35rem] top-1 w-4 h-4 rounded-full bg-slate-200" />
                          <div className="p-5">
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Coming Up: Nov 14</p>
                             <h4 className="font-bold text-slate-600">Deadline to respond to notice</h4>
                          </div>
                       </div>
                    </div>
                    <GatherCard />
                  </>
                )}

                {viewMode !== 'C' && <GatherCard />}

                {/* Shared Accordion Details */}
                <div className="pt-4">
                  <button className="w-full flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <History size={18} className="text-slate-400" />
                      <span className="text-sm font-bold text-slate-600">{t.details}</span>
                    </div>
                    <ChevronDown size={20} className="text-slate-300" />
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Sticky-ish Footer Actions */}
            <div className="pt-8 pb-12 space-y-6">
               <div className="grid grid-cols-2 gap-3">
                  <Button 
                    onClick={() => setActiveOverlay('drafting')}
                    variant="outline" 
                    className="!py-6 !rounded-3xl !flex-col !gap-2 !h-auto border-slate-100"
                  >
                    <PenTool size={20} className="text-blue-500" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Draft Response</span>
                  </Button>
                  <Button 
                    onClick={() => setActiveOverlay('legalaid')}
                    variant="outline" 
                    className="!py-6 !rounded-3xl !flex-col !gap-2 !h-auto border-slate-100"
                  >
                    <HelpingHand size={20} className="text-emerald-500" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Find Legal Aid</span>
                  </Button>
               </div>

               <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" className="!py-4 !rounded-2xl !text-[11px] !font-bold uppercase tracking-widest border-slate-200">
                        {t.viewDoc}
                      </Button>
                      <Button variant="outline" className="!py-4 !rounded-2xl !text-[11px] !font-bold uppercase tracking-widest border-slate-200">
                        {t.shareLawyer}
                      </Button>
                  </div>
                  <Button className="w-full !py-5 !rounded-[24px] !bg-slate-900 !text-white flex items-center justify-center gap-2">
                      <Bell size={18} />
                      {t.getReminders}
                  </Button>
               </div>
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {activeOverlay === 'drafting' && (
          <DraftingAssistant 
            documentType="Rent Increase Notice" 
            onBack={() => setActiveOverlay('none')} 
          />
        )}
        {activeOverlay === 'legalaid' && (
          <LegalAid onBack={() => setActiveOverlay('none')} />
        )}
      </AnimatePresence>
    </div>
  );
};
