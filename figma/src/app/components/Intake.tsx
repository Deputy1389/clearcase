import React from 'react';
import { motion } from 'motion/react';
import { 
  FileText, 
  Car, 
  Home as HomeIcon, 
  Briefcase, 
  HelpCircle, 
  ChevronLeft 
} from 'lucide-react';

interface IntakeProps {
  onBack: () => void;
  onSelect: (id: string) => void;
}

const options = [
  { id: 'document', label: 'I received a formal document', icon: FileText, desc: 'A letter, notice, or legal paper' },
  { id: 'accident', label: 'I was in an accident', icon: Car, desc: 'Vehicle collision or property damage' },
  { id: 'housing', label: 'Something with my housing', icon: HomeIcon, desc: 'Landlord, lease, or neighbor issue' },
  { id: 'work', label: 'A situation at my workplace', icon: Briefcase, desc: 'Employment, pay, or safety' },
  { id: 'other', label: 'Something else happened', icon: HelpCircle, desc: 'Other concerns' },
];

export const Intake: React.FC<IntakeProps> = ({ onBack, onSelect }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 px-8">
        <div className="mb-10">
          <h2 className="text-2xl font-light text-slate-800 mb-2">What happened?</h2>
          <p className="text-slate-500 text-sm">Select the category that best fits your current situation.</p>
        </div>

        <div className="space-y-4">
          {options.map((option, index) => (
            <motion.button
              key={option.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => onSelect(option.id)}
              className="w-full text-left p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-slate-300 hover:shadow-md transition-all group flex items-start gap-4 active:scale-[0.99]"
            >
              <div className="p-3 rounded-xl bg-slate-50 group-hover:bg-slate-100 transition-colors text-slate-600">
                <option.icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-slate-900 mb-0.5">{option.label}</div>
                <div className="text-xs text-slate-500 font-normal">{option.desc}</div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="p-8 text-center">
        <p className="text-xs text-slate-400 italic">
          Take your time. No need for complex details yet.
        </p>
      </div>
    </div>
  );
};
