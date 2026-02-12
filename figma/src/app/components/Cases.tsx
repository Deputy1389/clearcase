import React from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  Calendar, 
  AlertCircle, 
  ChevronRight,
  Plus
} from 'lucide-react';
import { Card, StatusChip, EmptyState } from './Common';

interface CasesProps {
  onSelectCase: (id: string) => void;
  onNewCase: () => void;
}

export const Cases: React.FC<CasesProps> = ({ onSelectCase, onNewCase }) => {
  const cases = [
    { id: '1', title: 'Apartment Lease', date: 'Oct 24, 2023', type: 'Residential Lease', priority: 'High', status: 'Review Ready' },
    { id: '2', title: 'Freelance Agreement', date: 'Sep 12, 2023', type: 'Employment', priority: 'Medium', status: 'Analyzed' },
    { id: '3', title: 'Terms of Service', date: 'Aug 05, 2023', type: 'Digital Agreement', priority: 'Low', status: 'Archived' }
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <div className="p-8 pb-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Your Cases</h1>
          <button 
            onClick={onNewCase}
            className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg shadow-slate-200 active:scale-90 transition-transform"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input 
            placeholder="Search documents..." 
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 shadow-sm"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-full whitespace-nowrap">All Cases</button>
          <button className="px-5 py-2.5 bg-white border border-slate-100 text-slate-500 text-xs font-bold rounded-full whitespace-nowrap">Active</button>
          <button className="px-5 py-2.5 bg-white border border-slate-100 text-slate-500 text-xs font-bold rounded-full whitespace-nowrap">Urgent</button>
          <button className="px-5 py-2.5 bg-white border border-slate-100 text-slate-500 text-xs font-bold rounded-full whitespace-nowrap">Archived</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-12">
        {cases.length > 0 ? (
          cases.map((c) => (
            <Card key={c.id} onClick={() => onSelectCase(c.id)} className="hover:border-slate-300 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <StatusChip 
                    label={c.priority} 
                    type={c.priority === 'High' ? 'error' : c.priority === 'Medium' ? 'warning' : 'neutral'} 
                  />
                  <StatusChip label={c.status} type="success" />
                </div>
                <ChevronRight className="text-slate-200" size={20} />
              </div>
              
              <h3 className="text-lg font-bold text-slate-900 mb-1">{c.title}</h3>
              <p className="text-sm text-slate-500 mb-4">{c.type}</p>
              
              <div className="flex items-center gap-4 pt-3 border-t border-slate-50">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Calendar size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{c.date}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <FileText size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">1 Doc</span>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <EmptyState 
            title="No cases yet" 
            description="Upload your first legal document to create a case and get clear insights."
            actionLabel="Start Upload"
            onAction={onNewCase}
          />
        )}
      </div>
    </div>
  );
};
