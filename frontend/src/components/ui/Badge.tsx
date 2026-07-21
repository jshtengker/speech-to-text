import React from 'react';

export interface BadgeProps {
  variant?: 'gold' | 'indigo' | 'emerald' | 'rose' | 'amber' | 'slate';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'gold',
  children,
  className = '',
}) => {
  const variantStyles = {
    gold: 'bg-[#c8864a]/10 text-[#e6b88a] border-[#c8864a]/30',
    indigo: 'bg-[#c8864a]/10 text-[#e6b88a] border-[#c8864a]/30',
    emerald: 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30',
    rose: 'bg-rose-950/40 text-rose-300 border-rose-800/50',
    amber: 'bg-amber-950/40 text-amber-300 border-amber-500/30',
    slate: 'bg-[#201e1b] border-[#2b2823] text-[#a39b91]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium backdrop-blur-sm ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
