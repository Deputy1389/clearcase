import React from 'react';
import { motion } from 'motion/react';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  ExternalLink,
  ChevronLeft
} from 'lucide-react';

interface VerdictProps {
  selection: string;
  onBack: () => void;
  onReset: () => void;
}

const mockVerdicts: Record<string, any> = {
  document: {
    verdict: "This is usually a legal issue",
    isLegal: true,
    looksLike: "Official notices usually carry legal weight and require a specific response within a deadline.",
    risk: "High",
    riskColor: "bg-red-50 text-red-700 border-red-100",
    time: "Usually urgent (14–30 days)",
    nextSteps: [
      "Keep the original envelope",
      "Check for a 'Deadline' or 'Response due' date",
      "Consider contacting a legal clinic for a quick review"
    ]
  },
  accident: {
    verdict: "This is likely a legal issue",
    isLegal: true,
    looksLike: "When insurance or liability is involved, the situation is governed by specific laws.",
    risk: "Medium",
    riskColor: "bg-amber-50 text-amber-700 border-amber-100",
    time: "Action needed within 48 hours for reports",
    nextSteps: [
      "Document everything with photos",
      "Avoid discussing fault at the scene",
      "Contact your insurance provider to start the process"
    ]
  },
  housing: {
    verdict: "This is often a legal issue",
    isLegal: true,
    looksLike: "Rental agreements and habitability issues are contractual and regulated by local law.",
    risk: "Medium",
    riskColor: "bg-amber-50 text-amber-700 border-amber-100",
    time: "Ongoing situation, track communications",
    nextSteps: [
      "Keep all communications in writing",
      "Take photos of any maintenance issues",
      "Look up local tenant rights organizations"
    ]
  },
  work: {
    verdict: "This may be a legal issue",
    isLegal: true,
    looksLike: "Employment issues depend heavily on your specific contract and local labor laws.",
    risk: "Medium",
    riskColor: "bg-amber-50 text-amber-700 border-amber-100",
    time: "Review contract before taking action",
    nextSteps: [
      "Locate and read your employment agreement",
      "Log occurrences with dates and details",
      "Review your employee handbook policy"
    ]
  },
  other: {
    verdict: "This might not be a legal issue yet",
    isLegal: false,
    looksLike: "Many situations can be resolved through direct communication before needing legal framework.",
    risk: "Low",
    riskColor: "bg-green-50 text-green-700 border-green-100",
    time: "Take time to observe and document",
    nextSteps: [
      "Try resolving via direct conversation first",
      "Note down why you feel this might be legal",
      "Keep records just in case things escalate"
    ]
  }
};

export const Verdict: React.FC<VerdictProps> = ({ selection, onBack, onReset }) => {
  const data = mockVerdicts[selection] || mockVerdicts.other;

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="text-sm font-medium text-slate-400">Analysis Result</span>
        <div className="w-10" /> {/* Spacer */}
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-6"
        >
          <div className={`inline-flex p-4 rounded-full mb-4 ${data.isLegal ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
            {data.isLegal ? <AlertTriangle className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 leading-tight">
            {data.verdict}
          </h2>
        </motion.div>

        <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">What this looks like</h3>
            <p className="text-slate-700 leading-relaxed text-[15px]">
              {data.looksLike}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-2xl border ${data.riskColor}`}>
              <h3 className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">Risk level</h3>
              <p className="font-semibold text-lg">{data.risk}</p>
            </div>
            <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50 text-slate-700">
              <h3 className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">Time sensitivity</h3>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                <p className="font-semibold text-[13px] leading-tight">{data.time}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">What people usually do next</h3>
          <ul className="space-y-4">
            {data.nextSteps.map((step: string, i: number) => (
              <li key={i} className="flex gap-3 items-start">
                <div className="w-5 h-5 rounded-full bg-slate-100 text-[10px] flex items-center justify-center font-bold text-slate-500 shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-sm text-slate-600 leading-normal">{step}</p>
              </li>
            ))}
          </ul>
        </section>

        <button 
          onClick={onReset}
          className="w-full py-4 border-2 border-slate-100 text-slate-500 rounded-2xl font-medium text-sm hover:bg-slate-50 transition-colors"
        >
          Check another situation
        </button>
      </div>

      <div className="p-8">
         <div className="flex items-center justify-center gap-2 text-slate-400">
            <span className="text-[10px]">Reference: Legal Clarity Guide (2026)</span>
            <ExternalLink className="w-3 h-3" />
         </div>
      </div>
    </div>
  );
};
