import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { Home } from './components/Home';
import { Cases } from './components/Cases';
import { Upload } from './components/Upload';
import { Workspace } from './components/Workspace';
import { Account, ProfileEdit } from './components/Account';
import { Onboarding } from './components/Onboarding';
import { Auth } from './components/Auth';
import { Paywall } from './components/Paywall';
import { BottomTabs } from './components/BottomTabs';
import { LimitModal, LockModal } from './components/Modals';
import { Storyboard } from './components/Storyboard';
import { AnimatePresence } from 'motion/react';
import { Layers, Lock as LockIcon } from 'lucide-react';
import { LockScreen } from './components/LockScreen';

type MainTab = 'home' | 'cases' | 'upload' | 'workspace' | 'account';
type FlowState = 'onboarding' | 'auth' | 'app' | 'profile-edit' | 'storyboard' | 'paywall';

export default function App() {
  const [flow, setFlow] = useState<FlowState>('onboarding');
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [lastFlow, setLastFlow] = useState<FlowState>('onboarding');
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [privacyEnabled, setPrivacyEnabled] = useState(false);
  
  // Modals state
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [lockFeature, setLockFeature] = useState<'reminders' | 'history'>('reminders');

  const handleOnboardingComplete = () => setFlow('auth');
  const handleAuthSuccess = () => setFlow('app');
  const handleLogout = () => setFlow('auth');
  const handleStartPlus = () => setFlow('paywall');
  
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
      {isAppLocked && <LockScreen onUnlock={() => setIsAppLocked(false)} />}

      {/* Dev Navigator Toggle */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
        {privacyEnabled && (
          <button 
            onClick={() => setIsAppLocked(true)}
            className="w-12 h-12 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-slate-800 transition-all active:scale-90"
            title="Lock App"
          >
            <LockIcon size={20} />
          </button>
        )}
        <button 
          onClick={toggleStoryboard}
          className="w-12 h-12 bg-white text-slate-900 rounded-full shadow-2xl flex items-center justify-center hover:bg-slate-50 transition-all active:scale-90 border border-slate-100"
          title="View Storyboard"
        >
          <Layers size={20} />
        </button>
      </div>

      {flow === 'storyboard' ? (
        <Storyboard 
          onClose={() => setFlow(lastFlow)} 
          onSelect={(s) => {
            if (s === 'home') { setFlow('app'); setActiveTab('home'); }
            else if (s === 'cases') { setFlow('app'); setActiveTab('cases'); }
            else if (s === 'intake' || s === 'upload') { setFlow('app'); setActiveTab('upload'); }
            else if (s === 'verdict' || s === 'workspace') { setFlow('app'); setActiveTab('workspace'); }
            else if (s === 'onboarding') setFlow('onboarding');
            else if (s === 'paywall') setFlow('paywall');
            else if (s.includes('auth')) setFlow('auth');
          }} 
        />
      ) : (
        <Layout>
          <AnimatePresence mode="wait">
            {flow === 'onboarding' && (
              <Onboarding 
                key="onboarding" 
                onComplete={handleOnboardingComplete} 
                onSubscribe={handleStartPlus}
              />
            )}

            {flow === 'paywall' && (
              <Paywall 
                key="paywall" 
                onClose={() => setFlow('app')} 
                onSubscribe={() => {
                  // Simulate subscription
                  setFlow('app');
                }} 
              />
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
                      <Account 
                        key="account" 
                        onEditProfile={() => setFlow('profile-edit')} 
                        onLogout={handleLogout} 
                        privacyEnabled={privacyEnabled}
                        onTogglePrivacy={() => setPrivacyEnabled(!privacyEnabled)}
                      />
                    )}
                  </AnimatePresence>
                </div>
                
                {/* Bottom Navigation */}
                <BottomTabs activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab as MainTab)} />
              </div>
            )}
          </AnimatePresence>

          {/* Global Modals */}
          <LimitModal 
            isOpen={isLimitModalOpen} 
            onClose={() => setIsLimitModalOpen(false)} 
            onUpgrade={() => {
              setIsLimitModalOpen(false);
              setFlow('paywall');
            }}
          />
          <LockModal 
            isOpen={isLockModalOpen} 
            feature={lockFeature}
            onClose={() => setIsLockModalOpen(false)} 
            onUpgrade={() => {
              setIsLockModalOpen(false);
              setFlow('paywall');
            }}
          />
        </Layout>
      )}
    </div>
  );
}
