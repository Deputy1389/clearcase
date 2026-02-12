import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Search, BookOpen, Scale, ArrowRight, ArrowLeft } from 'lucide-react';

interface Slide {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const slides: Slide[] = [
  {
    id: 1,
    title: "Legal clarity, made simple.",
    description: "We help you understand if a situation requires legal action, without the jargon.",
    icon: Scale,
    color: "bg-slate-100 text-slate-600",
  },
  {
    id: 2,
    title: "Is it a legal thing?",
    description: "Answer a few plain-English questions about what happened to get an immediate sense of direction.",
    icon: Search,
    color: "bg-blue-50 text-blue-600",
  },
  {
    id: 3,
    title: "Actionable guidance.",
    description: "Receive structured summaries of risks, timelines, and common next steps people take.",
    icon: BookOpen,
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    id: 4,
    title: "Privacy by design.",
    description: "Your situations are confidential. We provide information to empower you, not to collect your data.",
    icon: Shield,
    color: "bg-indigo-50 text-indigo-600",
  },
];

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const next = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(s => s + 1);
    } else {
      onComplete();
    }
  };

  const prev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(s => s - 1);
    }
  };

  const slide = slides[currentSlide];
  const Icon = slide.icon;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-6 flex justify-end">
        <button 
          onClick={onComplete}
          className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
        >
          Skip
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-10 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.1, y: -10 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            <div className={`w-24 h-24 rounded-[32px] ${slide.color} flex items-center justify-center mb-12 shadow-sm`}>
              <Icon size={40} strokeWidth={1.5} />
            </div>
            
            <h2 className="text-2xl font-semibold text-slate-900 mb-4 tracking-tight">
              {slide.title}
            </h2>
            
            <p className="text-slate-500 leading-relaxed text-[15px]">
              {slide.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="p-10 flex items-center justify-between">
        <button
          onClick={prev}
          disabled={currentSlide === 0}
          className={`p-4 rounded-full border border-slate-100 transition-all ${
            currentSlide === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100 active:scale-90 hover:bg-slate-50'
          }`}
        >
          <ArrowLeft size={20} className="text-slate-400" />
        </button>

        <div className="flex gap-2">
          {slides.map((_, i) => (
            <div 
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentSlide ? 'w-6 bg-slate-900' : 'w-1.5 bg-slate-200'
              }`}
            />
          ))}
        </div>

        <button
          onClick={next}
          className="p-4 rounded-full bg-slate-900 text-white shadow-lg active:scale-90 transition-all hover:bg-slate-800"
        >
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};
