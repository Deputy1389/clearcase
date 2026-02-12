import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Upload as UploadIcon, 
  File, 
  X, 
  Check, 
  Loader2, 
  ShieldCheck,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { Button, Card } from './Common';

interface UploadProps {
  onComplete: () => void;
  onCancel: () => void;
}

type UploadState = 'idle' | 'picking' | 'uploading' | 'processing' | 'done';

export const Upload: React.FC<UploadProps> = ({ onComplete, onCancel }) => {
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('Starting upload...');

  const stages = [
    { label: 'Uploading file...', threshold: 30 },
    { label: 'Extracting text content...', threshold: 60 },
    { label: 'Classifying document type...', threshold: 85 },
    { label: 'Generating plain English summary...', threshold: 100 }
  ];

  useEffect(() => {
    if (state === 'uploading' || state === 'processing') {
      const interval = setInterval(() => {
        setProgress(prev => {
          const next = prev + (Math.random() * 5);
          const currentStage = stages.find(s => next <= s.threshold) || stages[stages.length - 1];
          setStage(currentStage.label);
          
          if (next >= 100) {
            clearInterval(interval);
            setState('done');
            return 100;
          }
          return next;
        });
      }, 200);
      return () => clearInterval(interval);
    }
  }, [state]);

  const handleStartUpload = () => {
    setState('uploading');
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-8 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Upload</h1>
        <button onClick={onCancel} className="p-2 bg-slate-50 rounded-full text-slate-400">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 px-8 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {state === 'idle' && (
            <motion.div 
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <div className="w-20 h-20 bg-slate-900 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-slate-200">
                  <UploadIcon size={32} />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Add a document</h2>
                <p className="text-slate-500 text-sm max-w-[240px] mx-auto">Upload a PDF or take a photo of any legal document to get started.</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <Button 
                  onClick={handleStartUpload}
                  className="w-full !py-8 flex-col !rounded-3xl border-2 border-slate-900"
                  icon={<Camera size={24} />}
                >
                  <div className="flex flex-col items-center">
                    <span>Take a Photo</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Camera ready</span>
                  </div>
                </Button>
                
                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    variant="outline" 
                    onClick={handleStartUpload}
                    className="flex-col h-32 !rounded-3xl"
                    icon={<File size={20} />}
                  >
                    File / PDF
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleStartUpload}
                    className="flex-col h-32 !rounded-3xl"
                    icon={<UploadIcon size={20} />}
                  >
                    Gallery
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-start gap-3">
                <ShieldCheck className="text-emerald-500 shrink-0" size={18} />
                <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                  Your documents are encrypted and only accessible by you. We use enterprise-grade security for your data.
                </p>
              </div>
            </motion.div>
          )}

          {(state === 'uploading' || state === 'processing' || state === 'done') && (
            <motion.div 
              key="processing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-10"
            >
              <div className="relative w-32 h-32 mx-auto">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="58"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-slate-100"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="58"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={364}
                    strokeDashoffset={364 - (progress / 100) * 364}
                    className="text-slate-900 transition-all duration-300"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  {state === 'done' ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <CheckCircle2 size={48} className="text-emerald-500" />
                    </motion.div>
                  ) : (
                    <Loader2 size={32} className="text-slate-900 animate-spin" />
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-bold text-slate-900">
                  {state === 'done' ? 'Analysis Complete' : stage}
                </h3>
                <div className="max-w-[200px] mx-auto space-y-2">
                   {stages.map((s, idx) => (
                     <div key={idx} className="flex items-center gap-2 text-left">
                        <div className={`w-1.5 h-1.5 rounded-full ${progress >= s.threshold ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${progress >= s.threshold ? 'text-slate-900' : 'text-slate-300'}`}>
                          {s.label.split('...')[0]}
                        </span>
                     </div>
                   ))}
                </div>
              </div>

              {state === 'done' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 pt-4"
                >
                   <Card className="bg-slate-900 text-white border-none shadow-xl shadow-slate-200">
                      <div className="flex items-center gap-3 text-left">
                        <div className="p-3 bg-white/10 rounded-xl">
                          <Zap className="text-amber-400" size={20} />
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-white/60">Success</p>
                          <p className="text-sm font-medium">ClearCase identified this as a Residential Lease Agreement.</p>
                        </div>
                      </div>
                   </Card>
                   <Button onClick={onComplete} className="w-full">Open Workspace</Button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
