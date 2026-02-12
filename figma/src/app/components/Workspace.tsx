import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  FileText, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  MoreVertical,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronLeft
} from 'lucide-react';
import { Card, StatusChip, Button, Disclaimer, ListItem } from './Common';

interface CaseDetailProps {
  onBack: () => void;
}

export const Workspace: React.FC<CaseDetailProps> = ({ onBack }) => {
  const [activeCase] = useState({
    title: "Apartment Lease Agreement",
    status: "Review Ready",
    type: "Residential Lease",
    confidence: "98%",
    uploadedAt: "Oct 24, 2023",
    deadline: "Nov 01, 2023",
    urgent: true
  });

  const checklist = [
    { id: 1, text: "Verify security deposit return window (30 days)", completed: true },
    { id: 2, text: "Confirm subletting notice period (60 days)", completed: false },
    { id: 3, text: "Check maintenance response time clauses", completed: false },
    { id: 4, text: "Verify utility responsibility list", completed: false },
  ];

  const insights = [
    { label: "Document Type", value: "Lease Agreement", type: "neutral" },
    { label: "Confidence", value: "98% Match", type: "success" },
    { label: "Sensitivity", value: "High Priority", type: "error" },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Header */}
      <div className="p-8 pb-4 flex items-center gap-4">
        <button 
          onClick={onBack}
          className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 active:scale-95 transition-all shadow-sm"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-0.5">Workspace</h1>
          <p className="text-slate-500 text-xs font-medium">Active document insights</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 space-y-6 pb-12">
        {/* Main Case Card */}
        <Card className="border-l-4 border-l-rose-500">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <StatusChip label="High Sensitivity" type="error" />
                <StatusChip label="Needs Review" type="warning" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">{activeCase.title}</h2>
              <p className="text-sm text-slate-500">Analyzed on {activeCase.uploadedAt}</p>
            </div>
            <button className="p-2 -mr-2"><MoreVertical size={20} className="text-slate-400" /></button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Clock size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Next Deadline</span>
              </div>
              <p className="text-sm font-bold text-slate-800">{activeCase.deadline}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <CheckCircle2 size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Analysis Score</span>
              </div>
              <p className="text-sm font-bold text-slate-800">{activeCase.confidence}</p>
            </div>
          </div>

          <Button variant="outline" className="w-full justify-between" icon={<FileText size={18} />}>
            View Original Document
            <ExternalLink size={14} />
          </Button>
        </Card>

        {/* Plain English Summary */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Plain Language Summary</h3>
            <span className="text-emerald-600 text-[10px] font-bold uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-full">Automated</span>
          </div>
          <Card className="bg-white border-slate-200">
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              This document is a standard residential lease for a term of 12 months. Key points include a <span className="text-slate-900 font-bold">$2,400 security deposit</span> which must be returned within <span className="text-slate-900 font-bold">30 days</span> of move-out. 
            </p>
            <p className="text-sm text-slate-600 leading-relaxed">
              Wait — section 8.2 states you are responsible for <span className="font-bold underline">all exterior maintenance</span> including snow removal, which is unusual for a multi-unit building.
            </p>
          </Card>
        </div>

        {/* Action Checklist */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest px-2">Next Step Checklist</h3>
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
            {checklist.map((item, idx) => (
              <div 
                key={item.id} 
                className={`flex items-start gap-4 p-5 ${idx !== checklist.length - 1 ? 'border-b border-slate-50' : ''}`}
              >
                <button className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${item.completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-200'}`}>
                  {item.completed && <CheckCircle2 size={16} className="text-white" />}
                </button>
                <span className={`text-sm ${item.completed ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline Preview */}
        <div className="space-y-3 pb-8">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest px-2">Case Timeline</h3>
          <div className="space-y-4">
            {[
              { date: 'Today, 2:45 PM', event: 'Summary generated', icon: <FileText size={16} /> },
              { date: 'Oct 24, 11:15 AM', event: 'Document extraction completed', icon: <CheckCircle2 size={16} /> },
              { date: 'Oct 24, 11:12 AM', event: 'Document uploaded', icon: <Clock size={16} /> }
            ].map((item, idx) => (
              <div key={idx} className="flex gap-4 items-start pl-4 relative">
                {idx !== 2 && <div className="absolute left-[23px] top-6 w-[1px] h-full bg-slate-200" />}
                <div className="w-5 h-5 rounded-full bg-slate-100 border border-white flex items-center justify-center relative z-10 text-slate-400">
                  {item.icon}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.date}</p>
                  <p className="text-sm font-medium text-slate-600">{item.event}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Disclaimer />
      </div>
    </div>
  );
};
