import React from 'react';

export const GlobalLoader: React.FC = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white/80 z-50">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-sm text-slate-600">Loading...</p>
      </div>
    </div>
  );
};