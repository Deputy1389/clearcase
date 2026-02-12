import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Scale, 
  ArrowRight, 
  FileUp, 
  Clock, 
  ChevronRight, 
  AlertCircle,
  Zap,
  ShieldCheck,
  Search
} from 'lucide-react';
import { Card, StatusChip, Button, Disclaimer } from './Common';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface HomeProps {
  onStartUpload: () => void;
  onViewCase: (id: string) => void;
}

export const Home: React.FC<HomeProps> = ({ onStartUpload, onViewCase }) => {
  const [offline] = useState(false);

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Search Header */}
      <div className="p-8 pb-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-500 text-sm">Welcome back, Alex.</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs">
            AT
          </div>
        </div>

        {offline && (
          <div className="mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-3">
            <AlertCircle className="text-amber-600" size={20} />
            <p className="text-sm text-amber-900 font-medium">You're offline. Some features may be limited.</p>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input 
            placeholder="Search documents..." 
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 shadow-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 space-y-8 pb-12">
        {/* Upload Hero */}
        <Card className="bg-slate-900 text-white border-none shadow-2xl shadow-slate-200 overflow-hidden relative">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2">Something happened?</h2>
            <p className="text-white/60 text-sm mb-8 max-w-[200px] leading-relaxed">
              Upload any document to see if it's a legal thing... or not.
            </p>
            <Button onClick={onStartUpload} className="!bg-white !text-slate-900 !rounded-xl !px-6" icon={<FileUp size={18} />}>
              Upload Now
            </Button>
          </div>
          <div className="absolute right-[-20px] bottom-[-20px] opacity-10 rotate-12">
            <Scale size={180} />
          </div>
        </Card>

        {/* Recent Cases */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Active Cases</h3>
            <button className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">View All</button>
          </div>
          
          <div className="space-y-3">
             <Card onClick={() => onViewCase('1')} className="group">
                <div className="flex justify-between items-center mb-4">
                  <StatusChip label="Urgent" type="error" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nov 01 Deadline</span>
                </div>
                <h4 className="font-bold text-slate-800 mb-1 group-hover:text-slate-900">Apartment Lease Agreement</h4>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-slate-500">Analyzed 2 days ago</p>
                  <ChevronRight className="text-slate-300 group-hover:translate-x-1 transition-transform" size={18} />
                </div>
             </Card>

             <Card onClick={() => onViewCase('2')} className="group">
                <div className="flex justify-between items-center mb-4">
                  <StatusChip label="New" type="success" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Just Now</span>
                </div>
                <h4 className="font-bold text-slate-800 mb-1 group-hover:text-slate-900">Freelance Service Contract</h4>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-slate-500">Processing Pipeline...</p>
                  <ChevronRight className="text-slate-300 group-hover:translate-x-1 transition-transform" size={18} />
                </div>
             </Card>
          </div>
        </div>

        {/* Quick Tips */}
        <div className="space-y-4">
           <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest px-2">Pro Tips</h3>
           <div className="grid grid-cols-2 gap-4">
              <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3">
                  <Zap size={16} />
                </div>
                <h5 className="font-bold text-xs text-slate-800 mb-1">Fast Scan</h5>
                <p className="text-[10px] text-slate-500 leading-relaxed">Turn on flash for better document clarity.</p>
              </div>
              <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mb-3">
                  <ShieldCheck size={16} />
                </div>
                <h5 className="font-bold text-xs text-slate-800 mb-1">Privacy</h5>
                <p className="text-[10px] text-slate-500 leading-relaxed">Redact sensitive info before upload if needed.</p>
              </div>
           </div>
        </div>

        <Disclaimer />
      </div>
    </div>
  );
};
