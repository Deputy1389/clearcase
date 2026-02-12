import React from 'react';
import { motion } from 'motion/react';
import { Check, AlertCircle, Info, ChevronRight } from 'lucide-react';

// --- BUTTONS ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  isLoading, 
  icon, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";
  
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-800",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    outline: "border border-slate-200 text-slate-700 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-50",
    destructive: "bg-rose-50 text-rose-600 hover:bg-rose-100"
  };

  const sizes = {
    sm: "px-4 py-2 text-xs",
    md: "px-6 py-4 text-sm",
    lg: "px-8 py-5 text-base"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} 
      {...props}
    >
      {isLoading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
};

// --- CHIPS ---
export const StatusChip: React.FC<{ label: string; type?: 'success' | 'warning' | 'error' | 'info' | 'neutral' }> = ({ label, type = 'neutral' }) => {
  const styles = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-100",
    warning: "bg-amber-50 text-amber-700 border-amber-100",
    error: "bg-rose-50 text-rose-700 border-rose-100",
    info: "bg-blue-50 text-blue-700 border-blue-100",
    neutral: "bg-slate-50 text-slate-600 border-slate-100"
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[type]}`}>
      {label}
    </span>
  );
};

// --- CARDS ---
export const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm ${onClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''} ${className}`}
  >
    {children}
  </div>
);

// --- INPUTS ---
export const Input: React.FC<{ label?: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>> = ({ label, error, ...props }) => (
  <div className="space-y-1.5 w-full">
    {label && <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">{label}</label>}
    <input 
      className={`w-full px-4 py-4 bg-slate-50 border ${error ? 'border-rose-300' : 'border-slate-100'} rounded-2xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all`}
      {...props}
    />
    {error && <p className="text-[10px] text-rose-500 font-medium ml-1">{error}</p>}
  </div>
);

// --- LIST ITEMS ---
export const ListItem: React.FC<{ title: string; subtitle?: string; icon?: React.ReactNode; onClick?: () => void; badge?: string }> = ({ title, subtitle, icon, onClick, badge }) => (
  <button 
    onClick={onClick}
    className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-colors text-left"
  >
    <div className="flex items-center gap-4">
      {icon && <div className="p-3 bg-white rounded-xl border border-slate-100 text-slate-400 shadow-sm">{icon}</div>}
      <div>
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
    <div className="flex items-center gap-2 text-slate-300">
      {badge && <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full">{badge}</span>}
      <ChevronRight size={18} />
    </div>
  </button>
);

// --- STATES ---
export const EmptyState: React.FC<{ title: string; description: string; actionLabel?: string; onAction?: () => void; icon?: React.ReactNode }> = ({ title, description, actionLabel, onAction, icon }) => (
  <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-6">
      {icon || <AlertCircle size={32} />}
    </div>
    <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
    <p className="text-sm text-slate-500 mb-8 max-w-[240px] leading-relaxed">{description}</p>
    {actionLabel && <Button onClick={onAction}>{actionLabel}</Button>}
  </div>
);

export const Disclaimer: React.FC = () => (
  <div className="bg-slate-50 p-4 rounded-2xl flex gap-3 border border-slate-100">
    <Info className="w-5 h-5 text-slate-400 shrink-0" />
    <p className="text-[11px] leading-relaxed text-slate-500 italic">
      <span className="font-bold text-slate-600">Informational only.</span> This is not legal advice. ClearCase provides summaries to help you understand your documents, but should not replace professional counsel.
    </p>
  </div>
);
