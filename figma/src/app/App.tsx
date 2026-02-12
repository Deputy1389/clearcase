import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { Home } from './components/Home';
import { Cases } from './components/Cases';
import { Upload } from './components/Upload';
import { Workspace } from './components/Workspace';
import { Account, ProfileEdit } from './components/Account';
import { Onboarding } from './components/Onboarding';
import { Auth } from './components/Auth';
import { BottomTabs } from './components/BottomTabs';
import { Storyboard } from './components/Storyboard';
import { AnimatePresence } from 'motion/react';
import { Layers } from 'lucide-react';

type MainTab = 'home' | 'cases' | 'upload' | 'workspace' | 'account';
type FlowState = 'onboarding' | 'auth' | 'app' | 'profile-edit' | 'storyboard';

export default function App() {
  const [flow, setFlow] = useState<FlowState>('onboarding');
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [lastFlow, setLastFlow] = useState<FlowState>('onboarding');

  const handleOnboardingComplete = () => setFlow('auth');
  const handleAuthSuccess = () => setFlow('app');
  const handleLogout = () => setFlow('auth');
  
  const handleStartUpload = () => setActiveTab('upload');
  const handleUploadComplete = () => {
    setActiveTab('workspace');
    setSelectedCaseId('new');
  };
  
  const handleViewCase = (id: string) => {
    setSelectedCaseId(id);
    setActiveTab('workspace');
  };

  const toggleStoryboard = () => {
    if (flow === 'storyboard') {
      setFlow(lastFlow);
    } else {
      setLastFlow(flow);
      setFlow('storyboard');
    }
  };

  return (
    <div className="relative">
      {/* Dev Navigator Toggle */}
      <button 
        onClick={toggleStoryboard}
        className="fixed bottom-6 right-6 z-[100] w-12 h-12 bg-white text-slate-900 rounded-full shadow-2xl flex items-center justify-center hover:bg-slate-50 transition-all active:scale-90 border border-slate-100"
        title="View Storyboard"
      >
        <Layers size={20} />
      </button>

      {flow === 'storyboard' ? (
        <Storyboard 
          onClose={() => setFlow(lastFlow)} 
          onSelect={(s) => {
            if (s === 'home') { setFlow('app'); setActiveTab('home'); }
            else if (s === 'cases') { setFlow('app'); setActiveTab('cases'); }
            else if (s === 'intake' || s === 'upload') { setFlow('app'); setActiveTab('upload'); }
            else if (s === 'verdict' || s === 'workspace') { setFlow('app'); setActiveTab('workspace'); }
            else if (s === 'onboarding') setFlow('onboarding');
            else if (s.includes('auth')) setFlow('auth');
          }} 
        />
      ) : (
        <Layout>
          <AnimatePresence mode="wait">
            {flow === 'onboarding' && (
              <Onboarding key="onboarding" onComplete={handleOnboardingComplete} />
            )}
            
            {flow === 'auth' && (
              <Auth key="auth" onSuccess={handleAuthSuccess} />
            )}

            {flow === 'profile-edit' && (
              <ProfileEdit key="profile" onBack={() => setFlow('app')} onSave={() => setFlow('app')} />
            )}

            {flow === 'app' && (
              <div key="app-flow" className="flex flex-col h-full relative">
                <div className="flex-1 overflow-hidden relative">
                  <AnimatePresence mode="wait">
                    {activeTab === 'home' && (
                      <Home key="home" onStartUpload={handleStartUpload} onViewCase={handleViewCase} />
                    )}
                    {activeTab === 'cases' && (
                      <Cases key="cases" onSelectCase={handleViewCase} onNewCase={handleStartUpload} />
                    )}
                    {activeTab === 'upload' && (
                      <Upload key="upload" onComplete={handleUploadComplete} onCancel={() => setActiveTab('home')} />
                    )}
                    {activeTab === 'workspace' && (
                      <Workspace key="workspace" onBack={() => setActiveTab('cases')} />
                    )}
                    {activeTab === 'account' && (
                      <Account key="account" onEditProfile={() => setFlow('profile-edit')} onLogout={handleLogout} />
                    )}
                  </AnimatePresence>
                </div>
                
                {/* Bottom Navigation */}
                <BottomTabs activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab as MainTab)} />
              </div>
            )}
          </AnimatePresence>
        </Layout>
      )}
    </div>
  );
}
