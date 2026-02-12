import React from 'react';
import { Layout } from './Layout';
import { Home } from './Home';
import { Cases } from './Cases';
import { Upload } from './Upload';
import { Workspace } from './Workspace';
import { Account } from './Account';
import { Onboarding } from './Onboarding';
import { Auth } from './Auth';

interface StoryboardProps {
  onClose: () => void;
  onSelect: (screen: any, data?: any) => void;
}

export const Storyboard: React.FC<StoryboardProps> = ({ onClose, onSelect }) => {
  const screens = [
    { id: 'onboarding', name: 'Onboarding', component: <Onboarding onComplete={() => {}} /> },
    { id: 'auth-selection', name: 'Auth Selection', component: <Auth onSuccess={() => {}} /> },
    { id: 'home', name: 'Home Screen', component: <Home onStartUpload={() => {}} onViewCase={() => {}} /> },
    { id: 'cases', name: 'Cases List', component: <Cases onSelectCase={() => {}} onNewCase={() => {}} /> },
    { id: 'upload', name: 'Upload Flow', component: <Upload onComplete={() => {}} onCancel={() => {}} /> },
    { id: 'workspace', name: 'Workspace', component: <Workspace onBack={() => {}} /> },
    { id: 'account', name: 'Account Hub', component: <Account onEditProfile={() => {}} onLogout={() => {}} /> },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 overflow-y-auto p-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">ClearCase Storyboard</h1>
            <p className="text-slate-400">Click a screen to focus and interact with it.</p>
          </div>
          <button 
            onClick={onClose}
            className="px-6 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-colors"
          >
            Back to App
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {screens.map((item) => (
            <div key={item.id} className="space-y-4">
              <h3 className="text-slate-300 font-medium px-2">{item.name}</h3>
              <div 
                onClick={() => onSelect(item.id.includes('auth') ? 'auth' : item.id)}
                className="cursor-pointer group relative"
              >
                <div className="w-full aspect-[9/16] bg-white rounded-[32px] overflow-hidden shadow-2xl scale-[0.8] origin-top group-hover:scale-[0.82] transition-transform pointer-events-none ring-8 ring-slate-800">
                   {item.component}
                </div>
                <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors rounded-[32px]" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <span className="px-6 py-2 bg-white text-slate-900 rounded-full font-bold shadow-xl">Focus Screen</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
