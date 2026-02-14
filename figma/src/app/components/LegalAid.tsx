import React from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, MapPin, Phone, Globe, ExternalLink, Search, Heart } from 'lucide-react';
import { Card, Button } from './Common';

interface LegalAidProps {
  onBack: () => void;
}

const resources = [
  {
    name: "National Tenant Network",
    type: "Housing Rights",
    phone: "1-800-555-0123",
    website: "www.tenantrights.org",
    description: "Free legal advice for renters facing eviction or rent increases.",
    distance: "2.4 miles away"
  },
  {
    name: "Justice For All",
    type: "Pro-Bono Legal Aid",
    phone: "1-888-222-9900",
    website: "www.justiceforall.org",
    description: "Connecting low-income individuals with volunteer lawyers for civil cases.",
    distance: "3.1 miles away"
  },
  {
    name: "Employment Law Center",
    type: "Worker Rights",
    phone: "1-877-333-1122",
    website: "www.workrights.com",
    description: "Help with workplace discrimination, wage theft, and wrongful termination.",
    distance: "Local (Phone Only)"
  }
];

export const LegalAid: React.FC<LegalAidProps> = ({ onBack }) => {
  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="absolute inset-0 bg-white z-50 flex flex-col"
    >
      <div className="px-6 py-6 flex items-center gap-4 border-b border-slate-50">
        <button onClick={onBack} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-sm font-bold uppercase tracking-widest text-slate-400">Legal Resources</h1>
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Find help near you</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by city or topic..." 
            className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Heart size={14} className="text-rose-500" />
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recommended for you</h2>
          </div>

          {resources.map((res, i) => (
            <Card key={i} className="!p-6 border-slate-100">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="bg-blue-50 text-blue-600 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest inline-block mb-2">
                    {res.type}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{res.name}</h3>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <MapPin size={12} />
                  {res.distance}
                </div>
              </div>
              
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                {res.description}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="!py-3 !rounded-xl !text-xs !font-bold flex items-center justify-center gap-2 border-slate-100">
                  <Phone size={14} />
                  Call
                </Button>
                <Button variant="outline" className="!py-3 !rounded-xl !text-xs !font-bold flex items-center justify-center gap-2 border-slate-100">
                  <Globe size={14} />
                  Website
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-xl font-bold mb-2">Need a lawyer?</h3>
            <p className="text-white/60 text-sm mb-6 leading-relaxed">
              We can help you share your case file and summaries directly with a professional.
            </p>
            <Button className="!bg-white !text-slate-900 !rounded-xl !font-bold !text-xs !py-3">
              Share Case File
            </Button>
          </div>
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
        </div>
      </div>
    </motion.div>
  );
};
