import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 dark:bg-slate-800 dark:border-slate-700 ${className}`}>
      {children}
    </div>
  );
};
