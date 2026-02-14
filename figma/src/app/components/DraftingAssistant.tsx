import React from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Send, FileText, Mail, MessageSquare, Copy, Check } from 'lucide-react';
import { Card, Button } from './Common';

interface DraftingAssistantProps {
  onBack: () => void;
  documentType: string;
}

const templates = [
  {
    id: 'repair-request',
    title: 'Request Repairs',
    description: 'A formal but polite request for maintenance or repairs.',
    subject: 'Request for Maintenance - [Property Address]',
    body: 'Dear [Landlord Name],\n\nI am writing to formally request repairs at my residence. Specifically, the [Issue] needs attention. According to our lease agreement, maintenance of this item is the landlord\'s responsibility. \n\nPlease let me know when a contractor can be scheduled to look at this. Thank you for your prompt attention.\n\nBest regards,\n[Your Name]'
  },
  {
    id: 'extension-request',
    title: 'Extension Request',
    description: 'Ask for more time to respond or move out.',
    subject: 'Request for Extension - Notice dated [Date]',
    body: 'Dear [Name],\n\nI am writing regarding the notice I received on [Date]. Due to [Reason], I would like to request an extension of [Number] days to [Action Required]. \n\nI appreciate your understanding and look forward to your confirmation.\n\nSincerely,\n[Your Name]'
  },
  {
    id: 'clarification',
    title: 'Clarification Request',
    description: 'Ask for more details about a notice you received.',
    subject: 'Question regarding [Document Name]',
    body: 'Hello,\n\nI received your notice regarding [Topic] but I am unclear on [Specific Point]. Could you please provide more detail or a copy of [Reference Document] so I can better understand my obligations?\n\nThank you,\n[Your Name]'
  }
];

export const DraftingAssistant: React.FC<DraftingAssistantProps> = ({ onBack, documentType }) => {
  const [selectedTemplate, setSelectedTemplate] = React.useState<typeof templates[0] | null>(null);
  const [copied, setCopied] = React.useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          <h1 className="text-sm font-bold uppercase tracking-widest text-slate-400">Drafting Assistant</h1>
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Responses for {documentType}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {!selectedTemplate ? (
          <>
            <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
              <h2 className="text-blue-900 font-bold mb-1">Pick a starting point</h2>
              <p className="text-blue-700/70 text-sm leading-relaxed">
                Choose a template below. We've written these in plain English to keep things professional and clear.
              </p>
            </div>

            <div className="space-y-3">
              {templates.map((t) => (
                <button 
                  key={t.id}
                  onClick={() => setSelectedTemplate(t)}
                  className="w-full text-left p-5 bg-white border border-slate-100 rounded-[24px] hover:border-blue-200 transition-colors group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 mb-1">{t.title}</h3>
                      <p className="text-xs text-slate-500">{t.description}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                      <Send size={14} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setSelectedTemplate(null)}
                className="text-xs font-bold text-blue-600 uppercase tracking-widest"
              >
                ← Back to list
              </button>
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleCopy(selectedTemplate.body)}
                  variant="outline" 
                  className="!py-2 !px-4 !rounded-full !text-[10px] flex items-center gap-1.5"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy Text'}
                </Button>
              </div>
            </div>

            <Card className="!p-0 overflow-hidden border-slate-100">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Subject</p>
                <p className="text-sm font-medium text-slate-900">{selectedTemplate.subject}</p>
              </div>
              <div className="p-6">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Message Body</p>
                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-mono bg-slate-50/50 p-4 rounded-xl border border-slate-50">
                  {selectedTemplate.body}
                </div>
              </div>
            </Card>

            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
              <div className="shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <FileText size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-900 mb-0.5">Tip: Edit bracketed text</p>
                <p className="text-[11px] text-amber-800/70">Make sure to replace things like [Landlord Name] with the actual details before sending.</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <div className="p-6 border-t border-slate-50 bg-white">
        <p className="text-center text-[10px] text-slate-400 font-medium leading-relaxed">
          These templates are for guidance only and do not constitute legal advice.
        </p>
      </div>
    </motion.div>
  );
};
