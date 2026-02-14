import React from 'react';
import { motion } from 'motion/react';
import { Lock, Fingerprint, ShieldCheck } from 'lucide-react';
import { Button } from './Common';

interface LockScreenProps {
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[200] bg-slate-900 flex flex-col items-center justify-center p-8"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col items-center"
      >
        <div className="w-20 h-20 bg-white/10 rounded-[32px] flex items-center justify-center text-white mb-8">
          <Lock size={32} />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">ClearCase Locked</h1>
        <p className="text-white/40 text-sm text-center max-w-[240px] leading-relaxed mb-12">
          Your documents are protected by your device's security.
        </p>

        <Button 
          onClick={onUnlock}
          className="!bg-white !text-slate-900 !rounded-full !px-8 !py-4 flex items-center gap-3 active:scale-95 transition-all"
        >
          <Fingerprint size={20} />
          Use Biometrics
        </Button>

        <button 
          onClick={onUnlock}
          className="mt-6 text-[10px] font-bold text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors"
        >
          Use Device PIN
        </button>
      </motion.div>

      <div className="absolute bottom-12 flex items-center gap-2 text-white/20">
        <ShieldCheck size={14} />
        <span className="text-[10px] font-bold uppercase tracking-widest">End-to-End Encrypted</span>
      </div>
    </motion.div>
  );
};
