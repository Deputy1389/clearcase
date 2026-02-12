import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Scale, ChevronLeft, ArrowRight, ShieldCheck, Briefcase, Sparkles } from 'lucide-react';

interface AuthProps {
  onSuccess: () => void;
  onBack?: () => void;
}

type AuthMode = 'selection' | 'login' | 'signup' | 'disclaimer' | 'waitlist';

export const Auth: React.FC<AuthProps> = ({ onSuccess, onBack }) => {
  const [mode, setMode] = useState<AuthMode>('selection');
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  const handleAction = () => {
    setMode('disclaimer');
  };

  const handleAgree = () => {
    onSuccess();
  };

  if (mode === 'selection') {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center mb-16"
          >
            <span className="text-xl font-medium text-slate-400 mb-2">Welcome To</span>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
                <Scale className="text-white w-6 h-6" />
              </div>
              <h1 className="text-4xl font-bold text-slate-900 tracking-tight">ClearCase</h1>
            </div>
          </motion.div>

          <div className="w-full space-y-4 max-w-xs">
            <button 
              onClick={() => setMode('login')}
              className="w-full py-4.5 bg-slate-900 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:bg-slate-800"
            >
              Log In <ArrowRight size={18} />
            </button>
            
            <button 
              onClick={() => setMode('signup')}
              className="w-full py-4.5 border-2 border-slate-900 text-slate-900 rounded-2xl font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:bg-slate-50"
            >
              Sign Up <ArrowRight size={18} />
            </button>

            <button 
              onClick={handleAction}
              className="w-full py-4 text-slate-400 text-sm font-medium hover:text-slate-600 transition-colors"
            >
              Contact Support
            </button>
          </div>
        </div>

        <div className="p-10 border-t border-slate-50 bg-slate-50/30">
          <div className="flex flex-col items-center gap-4">
             <div className="flex items-center gap-2 text-slate-300">
                <Scale size={16} />
                <span className="font-bold text-xs uppercase tracking-widest">ClearCase</span>
             </div>
             <div className="flex gap-4 text-xs font-medium text-slate-400">
                <button className="hover:text-slate-600 transition-colors">Terms of Use</button>
                <div className="w-px h-3 bg-slate-200" />
                <button className="hover:text-slate-600 transition-colors">Privacy Policy</button>
             </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'waitlist') {
    return (
      <div className="flex flex-col h-full bg-white px-8 pt-6">
        <button 
          onClick={() => {
            setMode('signup');
            setWaitlistSubmitted(false);
          }}
          className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors self-start mb-8"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="mb-10">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
            <Briefcase size={24} />
          </div>
          <h2 className="text-3xl font-semibold text-slate-900 mb-2">
            Professional Access
          </h2>
          <p className="text-slate-500 text-[15px] leading-relaxed">
            Join the waitlist for ClearCase Pro. We're building specialized tools for intake, document triage, and client communication.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!waitlistSubmitted ? (
            <motion.div 
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Firm Name</label>
                <input 
                  type="text" 
                  placeholder="Lexington Law Group"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:bg-white transition-all text-slate-900 placeholder:text-slate-300"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Professional Email</label>
                <input 
                  type="email" 
                  placeholder="partner@firm.com"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:bg-white transition-all text-slate-900 placeholder:text-slate-300"
                />
              </div>
              <button 
                onClick={() => setWaitlistSubmitted(true)}
                className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/10 active:scale-[0.98] transition-all hover:bg-blue-700 mt-4"
              >
                Request Access
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-50 rounded-3xl p-8 text-center border border-green-100"
            >
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-green-100">
                <ShieldCheck className="text-green-500 w-8 h-8" />
              </div>
              <h3 className="text-green-900 font-bold text-xl mb-2">Request Received</h3>
              <p className="text-green-700/70 text-sm leading-relaxed mb-6">
                Thank you for your interest. Our team will reach out to your firm's email once we begin onboarding our next cohort of legal professionals.
              </p>
              <button 
                onClick={() => setMode('signup')}
                className="text-green-800 font-bold text-xs uppercase tracking-widest border-b-2 border-green-200 pb-0.5"
              >
                Return to Signup
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (mode === 'disclaimer') {
    return (
      <div className="flex flex-col h-full bg-slate-500 p-8">
        <div className="flex-1 flex flex-col pt-12">
          <div className="flex items-center gap-3 mb-8">
            <ShieldCheck className="text-white/80 w-8 h-8" />
            <h2 className="text-2xl font-bold text-white">Disclaimer & Legal Notice</h2>
          </div>

          <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
            <div className="space-y-3">
               <p className="text-white/90 text-[15px] leading-relaxed">
                 • Please note that ClearCase is an information-only tool and not a lawyer. As such, the software and all outcomes are provided "as is." We do not guarantee accuracy, reliability, or completeness.
               </p>
               <p className="text-white/90 text-[15px] leading-relaxed">
                 • <strong>Not Legal Advice:</strong> ClearCase is designed to assist you with general understanding but it is not a substitute for professional advice from a qualified, state-licensed attorney. For specific legal concerns, consult a legal professional.
               </p>
            </div>

            <div className="pt-4">
              <h3 className="text-white font-bold text-lg mb-4">User Acknowledgment for Data Privacy & Confidentiality</h3>
              <p className="text-white/80 text-sm italic mb-4">By clicking "Agree & Continue to ClearCase"</p>
              
              <div className="bg-white rounded-3xl p-6 shadow-xl">
                 <h4 className="font-bold text-slate-900 mb-4">I acknowledge and agree that:</h4>
                 <ul className="space-y-3">
                   <li className="flex gap-3 text-sm text-slate-600 leading-snug">
                     <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                     My personal information and case details will be kept strictly confidential.
                   </li>
                   <li className="flex gap-3 text-sm text-slate-600 leading-snug">
                     <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                     Data is processed for the sole purpose of providing situational clarity.
                   </li>
                   <li className="flex gap-3 text-sm text-slate-600 leading-snug">
                     <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                     No attorney-client relationship is created by using this application.
                   </li>
                 </ul>

                 <button 
                  onClick={handleAgree}
                  className="w-full mt-8 py-4 bg-slate-900 text-white rounded-2xl font-bold active:scale-[0.98] transition-all"
                >
                  Agree & Continue to ClearCase
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white px-8 pt-6">
      <button 
        onClick={() => setMode('selection')}
        className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors self-start mb-8"
      >
        <ChevronLeft size={24} />
      </button>

      <div className="mb-10">
        <h2 className="text-3xl font-semibold text-slate-900 mb-2">
          {mode === 'signup' ? 'Join ClearCase' : 'Welcome Back'}
        </h2>
        <p className="text-slate-500 text-[15px]">
          {mode === 'signup' ? 'Start your journey towards legal clarity.' : 'Sign in to access your saved cases.'}
        </p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 pb-12"
      >
      {mode === 'signup' && (
        <div className="mb-8">
          <p className="text-xs font-medium text-slate-500">Creating your individual account</p>
        </div>
      )}

        {mode === 'signup' && (
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Full Name</label>
            <input 
              type="text" 
              placeholder="John Doe"
              className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:bg-white transition-all text-slate-900 placeholder:text-slate-300"
            />
          </div>
        )}

        {mode === 'signup' && (
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">ZIP Code</label>
            <input 
              type="text" 
              placeholder="90210"
              className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:bg-white transition-all text-slate-900 placeholder:text-slate-300"
            />
          </div>
        )}

        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Email Address</label>
          <input 
            type="email" 
            placeholder="john@example.com"
            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:bg-white transition-all text-slate-900 placeholder:text-slate-300"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Password</label>
          <input 
            type="password" 
            placeholder="••••••••"
            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:bg-white transition-all text-slate-900 placeholder:text-slate-300"
          />
        </div>

        <div className="pt-4">
          <button 
            onClick={handleAction}
            className="w-full py-5 bg-slate-900 text-white rounded-2xl font-medium shadow-lg shadow-slate-900/10 active:scale-[0.98] transition-all hover:bg-slate-800"
          >
            {mode === 'signup' ? 'Create account' : 'Sign In'}
          </button>
        </div>

        {mode === 'signup' && (
          <div className="pt-8 mt-4 border-t border-slate-50">
            <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 flex items-start gap-4">
              <div className="p-2 bg-white rounded-xl text-blue-500 shadow-sm">
                <Briefcase size={18} />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                  Are you a Professional?
                  <Sparkles size={12} className="text-amber-400 fill-amber-400" />
                </p>
                <p className="text-[11px] text-slate-500 leading-normal mb-3">
                  Interested in ClearCase for your law firm or practice? Join our professional waitlist.
                </p>
                <button 
                  onClick={() => setMode('waitlist')}
                  className="text-[11px] font-bold text-blue-600 uppercase tracking-wider hover:text-blue-700 transition-colors"
                >
                  Request Access →
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
