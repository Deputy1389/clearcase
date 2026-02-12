import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#111827] flex justify-center p-4">
      {/* Android Frame Mockup - for desktop preview */}
      <div className="w-full max-w-[450px] bg-white shadow-xl rounded-[40px] overflow-hidden relative border-8 border-[#F3F4F6] flex flex-col h-[850px]">
        {/* Sidebar Component */}
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        {/* Status Bar */}
        <div className="h-12 px-6 flex justify-between items-center bg-white relative z-20">
          <span className="text-xs font-semibold text-slate-800">9:41</span>
          <div className="flex gap-4 items-center">
            <div className="flex gap-1.5 items-center">
              <div className="w-4 h-4 rounded-full border border-slate-200" />
              <div className="w-4 h-4 rounded-full bg-slate-100" />
            </div>
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -mr-2 text-slate-400 hover:text-slate-900 transition-colors bg-slate-50 rounded-full"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto scrollbar-hide relative">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="h-full flex flex-col"
          >
            {children}
          </motion.div>
        </main>

        {/* Navigation Bar (Android style) */}
        <div className="h-14 flex items-center justify-center gap-20 bg-white border-t border-gray-100">
          <div className="w-4 h-4 border-2 border-gray-300 rounded-sm" />
          <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
          <div className="w-0 h-0 border-y-[6px] border-y-transparent border-r-[10px] border-r-gray-300" />
        </div>
      </div>
    </div>
  );
};
