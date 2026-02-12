import React, { useState } from 'react';
import { 
  User, 
  Settings, 
  CreditCard, 
  Bell, 
  ShieldCheck, 
  FileText, 
  HelpCircle, 
  LogOut, 
  ChevronRight,
  MapPin,
  Mail,
  Edit2,
  X,
  Camera,
  Briefcase,
  ExternalLink,
  Sparkles,
  ChevronLeft,
  CheckCircle2
} from 'lucide-react';
import { Card, ListItem, Button } from './Common';
import { motion, AnimatePresence } from 'motion/react';

interface AccountProps {
  onEditProfile: () => void;
  onLogout: () => void;
}

export const Account: React.FC<AccountProps> = ({ onEditProfile, onLogout }) => {
  const [user] = useState({
    name: "Alex Thompson",
    email: "alex.t@example.com",
    jurisdiction: "California, USA",
    plan: "Free Tier"
  });

  const [showWaitlist, setShowWaitlist] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (showWaitlist) {
    return (
      <div className="flex flex-col h-full bg-white px-8 pt-8">
        <button 
          onClick={() => {
            setShowWaitlist(false);
            setSubmitted(false);
          }}
          className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 mb-8 active:scale-95 transition-all"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="mb-10">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6 shadow-sm">
            <Briefcase size={24} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Professional Access</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            Request early access to our document triage suite for law firms and legal departments.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.div 
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Firm or Company Name</label>
                <input placeholder="Lexington Law Group" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Practice Area</label>
                <input placeholder="Real Estate, Family Law, etc." className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <Button onClick={() => setSubmitted(true)} className="w-full !py-4.5 !bg-blue-600 !text-white !rounded-2xl mt-4">
                Join Waitlist
              </Button>
            </motion.div>
          ) : (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-blue-50 rounded-3xl p-8 text-center border border-blue-100"
            >
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-blue-100">
                <CheckCircle2 className="text-blue-500 w-8 h-8" />
              </div>
              <h3 className="text-slate-900 font-bold text-lg mb-2">Application Sent</h3>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                Thank you. We'll verify your details and reach out when a professional seat becomes available.
              </p>
              <button 
                onClick={() => setShowWaitlist(false)}
                className="text-blue-600 font-bold text-xs uppercase tracking-widest"
              >
                Return to Account
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Header / Profile Summary */}
      <div className="p-8 pb-10 bg-white border-b border-slate-100">
        <div className="flex justify-between items-start mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Account</h1>
          <button 
            onClick={onEditProfile}
            className="p-3 bg-slate-50 text-slate-600 rounded-2xl border border-slate-100 active:scale-95 transition-all"
          >
            <Edit2 size={18} />
          </button>
        </div>

        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-[28px] bg-slate-900 flex items-center justify-center text-white text-2xl font-bold shadow-xl shadow-slate-200">
            AT
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
            <div className="flex flex-col gap-1 mt-1">
              <div className="flex items-center gap-2 text-slate-400">
                <Mail size={12} />
                <span className="text-xs font-medium">{user.email}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin size={12} />
                <span className="text-xs font-medium">{user.jurisdiction}</span>
              </div>
            </div>
          </div>
        </div>

        <Card className="mt-8 bg-slate-900 text-white border-none shadow-xl shadow-slate-200 p-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Current Plan</p>
            <h4 className="font-bold text-base">ClearCase Basic</h4>
          </div>
          <Button variant="ghost" className="!bg-white/10 !text-white !px-4 !py-2 !rounded-xl !text-xs">
            Upgrade
          </Button>
        </Card>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 pb-12">
        {/* Personal Settings */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Personal Settings</h3>
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
            <ListItem title="Notifications" subtitle="Alerts, Deadlines & Updates" icon={<Bell size={18} />} />
            <ListItem title="Billing & Plans" subtitle="Manage your subscription" icon={<CreditCard size={18} />} />
            <ListItem title="Security" subtitle="Password & Two-Factor" icon={<ShieldCheck size={18} />} />
          </div>
        </div>

        {/* Preferences */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Preferences</h3>
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
            <ListItem title="Preferred Language" subtitle="English (US)" icon={<FileText size={18} />} />
            <ListItem title="Jurisdiction" subtitle="California, USA" icon={<MapPin size={18} />} />
          </div>
        </div>

        {/* Lawyer Waitlist */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Are you a Professional?</h3>
          <Card className="bg-gradient-to-br from-slate-50 to-blue-50/30 border-blue-100/50 p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white rounded-2xl text-blue-500 shadow-sm border border-blue-50">
                <Briefcase size={20} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                  ClearCase for Law Firms
                  <Sparkles size={14} className="text-amber-400 fill-amber-400" />
                </h4>
                <p className="text-[12px] text-slate-500 leading-relaxed mb-4">
                  Streamline intake and document triage with our professional suite. Currently in private beta.
                </p>
                <Button 
                  onClick={() => setShowWaitlist(true)}
                  variant="outline" 
                  className="!py-2 !px-4 !text-xs !rounded-xl !border-blue-200 !text-blue-600 !bg-white/50 hover:!bg-white"
                >
                  Join Professional Waitlist
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Support & Legal */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Support & Legal</h3>
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
            <ListItem title="Help Center" icon={<HelpCircle size={18} />} />
            <ListItem title="Privacy Policy" icon={<ShieldCheck size={18} />} />
            <ListItem title="Terms of Service" icon={<FileText size={18} />} />
          </div>
        </div>

        <Button 
          variant="destructive" 
          onClick={onLogout}
          className="w-full justify-between"
          icon={<LogOut size={18} />}
        >
          Sign Out
        </Button>

        <p className="text-[10px] text-center text-slate-400 uppercase tracking-widest pt-4">
          ClearCase Version 1.0.4 (Build 42)
        </p>
      </div>
    </div>
  );
};

export const ProfileEdit: React.FC<{ onBack: () => void; onSave: () => void }> = ({ onBack, onSave }) => {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-8 flex justify-between items-center">
        <button onClick={onBack} className="p-2 bg-slate-50 rounded-full text-slate-400">
          <X size={20} />
        </button>
        <h1 className="text-lg font-bold text-slate-900">Edit Profile</h1>
        <button onClick={onSave} className="text-sm font-bold text-slate-900">Save</button>
      </div>

      <div className="p-8 space-y-6">
        <div className="flex flex-col items-center mb-8">
           <div className="w-24 h-24 rounded-[32px] bg-slate-100 border-4 border-white shadow-xl flex items-center justify-center text-slate-300 relative group cursor-pointer">
              <User size={40} />
              <div className="absolute inset-0 bg-black/5 rounded-[32px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={24} className="text-white" />
              </div>
           </div>
           <button className="mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Change Photo</button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
            <input defaultValue="Alex Thompson" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/5" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
            <input defaultValue="alex.t@example.com" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/5" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">ZIP / Postal Code</label>
            <input defaultValue="90210" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/5" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Jurisdiction</label>
            <select className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/5 appearance-none">
              <option>California, USA</option>
              <option>New York, USA</option>
              <option>Texas, USA</option>
              <option>Other / International</option>
            </select>
          </div>
        </div>

        <div className="pt-8">
           <Button onClick={onSave} className="w-full">Save Changes</Button>
        </div>
      </div>
    </div>
  );
};
