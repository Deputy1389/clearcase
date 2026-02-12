import React from 'react';
import { Home, Briefcase, PlusCircle, LayoutDashboard, User } from 'lucide-react';

interface BottomTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const BottomTabs: React.FC<BottomTabsProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'cases', icon: Briefcase, label: 'Cases' },
    { id: 'upload', icon: PlusCircle, label: 'Upload', isSpecial: true },
    { id: 'account', icon: User, label: 'Account' },
  ];

  return (
    <div className="h-[84px] pb-6 flex items-center justify-around bg-white border-t border-slate-100 px-2 relative z-10">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        if (tab.isSpecial) {
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center justify-center -mt-8"
            >
              <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${isActive ? 'bg-slate-900 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                <Icon size={28} />
              </div>
              <span className={`text-[10px] font-bold mt-2 ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>{tab.label}</span>
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="flex flex-col items-center justify-center py-2 px-3 gap-1 group"
          >
            <Icon 
              size={22} 
              className={`transition-colors ${isActive ? 'text-slate-900' : 'text-slate-300 group-hover:text-slate-500'}`} 
            />
            <span className={`text-[10px] font-bold transition-colors ${isActive ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'}`}>
              {tab.label}
            </span>
            {isActive && <div className="w-1 h-1 rounded-full bg-slate-900 mt-0.5" />}
          </button>
        );
      })}
    </div>
  );
};
