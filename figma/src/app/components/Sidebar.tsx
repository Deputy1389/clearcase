import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ChevronDown, 
  ChevronUp, 
  MessageSquare, 
  Briefcase, 
  Folder, 
  Settings, 
  Info, 
  LogOut, 
  Scale, 
  CreditCard, 
  Bell, 
  User, 
  ShieldCheck, 
  FileText, 
  HelpCircle,
  MoreHorizontal
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavGroupProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const NavGroup: React.FC<NavGroupProps> = ({ title, icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-2">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${isOpen ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
      >
        <div className="flex items-center gap-3">
          <div className="text-slate-500">{icon}</div>
          <span className="font-medium text-slate-800">{title}</span>
          <Info size={14} className="text-slate-300 ml-1" />
        </div>
        {isOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pl-12 py-2 space-y-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 z-40 backdrop-blur-[2px]"
          />
          
          {/* Sidebar Panel */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute top-0 left-0 bottom-0 w-[85%] bg-white z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="p-6 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
                  <Scale className="w-6 h-6 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold tracking-tight text-slate-900">ClearCase</span>
                  <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold -mt-1">Legal Clarity</span>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
              <NavGroup title="Assessments" icon={<MessageSquare size={20} />}>
                <button className="w-full text-left py-1 text-slate-500 hover:text-slate-800 transition-colors">Active Cases</button>
                <button className="w-full text-left py-1 text-slate-500 hover:text-slate-800 transition-colors">Past Decisions</button>
                <button className="w-full text-left py-1 text-slate-500 hover:text-slate-800 transition-colors">Archived</button>
              </NavGroup>

              <NavGroup title="Legal Files" icon={<Briefcase size={20} />} defaultOpen={true}>
                <button className="w-full text-left py-1 text-slate-500 hover:text-slate-800 transition-colors">Draft Documents</button>
                <button className="w-full text-left py-1 text-slate-500 hover:text-slate-800 transition-colors">Shared with Counsel</button>
                <button className="w-full text-left py-1 text-slate-500 hover:text-slate-800 transition-colors">Messages</button>
              </NavGroup>

              <NavGroup title="Folders" icon={<Folder size={20} />}>
                <button className="w-full text-left py-1 text-slate-500 hover:text-slate-800 transition-colors">New Folder</button>
              </NavGroup>

              <div className="my-6 border-t border-slate-100 pt-6">
                <span className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-4">Recent Assessments</span>
                <div className="space-y-4 px-3">
                  <div className="flex justify-between items-start group cursor-pointer">
                    <p className="text-sm text-slate-600 line-clamp-1 flex-1 pr-4 group-hover:text-slate-900 transition-colors">
                      Employment contract review...
                    </p>
                    <MoreHorizontal size={16} className="text-slate-300" />
                  </div>
                  <div className="flex justify-between items-start group cursor-pointer">
                    <p className="text-sm text-slate-600 line-clamp-1 flex-1 pr-4 group-hover:text-slate-900 transition-colors">
                      Car accident liability check
                    </p>
                    <MoreHorizontal size={16} className="text-slate-300" />
                  </div>
                </div>
              </div>

              <NavGroup title="Settings" icon={<Settings size={20} />}>
                <div className="space-y-3 pt-2">
                  <button className="flex items-center gap-3 w-full text-left text-slate-500 hover:text-slate-800 transition-colors">
                    <CreditCard size={18} /> Plans & Pricing
                  </button>
                  <button className="flex items-center gap-3 w-full text-left text-slate-500 hover:text-slate-800 transition-colors text-[13px]">Subscription History</button>
                  <button className="flex items-center gap-3 w-full text-left text-slate-500 hover:text-slate-800 transition-colors text-[13px]">Transaction History</button>
                  <button className="flex items-center gap-3 w-full text-left text-slate-500 hover:text-slate-800 transition-colors text-[13px]">FAQs</button>
                  <button className="flex items-center gap-3 w-full text-left text-slate-500 hover:text-slate-800 transition-colors text-[13px]">Manage Notifications</button>
                  <button className="flex items-center gap-3 w-full text-left text-slate-500 hover:text-slate-800 transition-colors text-[13px]">Delete Account</button>
                </div>
              </NavGroup>
            </div>

            {/* Bottom Section */}
            <div className="p-6 bg-slate-50 mt-auto border-t border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold text-slate-500">Credits Remaining:</span>
                <span className="text-xs font-bold text-rose-500 uppercase tracking-wider">0 Credits Left</span>
              </div>
              
              <button className="w-full bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow active:scale-[0.98]">
                <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center shrink-0">
                  <Scale className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-slate-800 text-sm">Upgrade to ClearCase Pro</h4>
                  <p className="text-xs text-slate-500">Unlimited legal assessments...</p>
                </div>
              </button>
              
              <button className="flex items-center gap-2 mt-6 text-slate-400 hover:text-rose-500 transition-colors text-sm font-medium w-fit">
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
