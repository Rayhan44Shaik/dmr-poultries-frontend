// src/components/common/PageLayout.tsx

import React from 'react';

export type PageLayoutProps = {
  children: React.ReactNode;
  className?: string;
};

export default function PageLayout({ children, className = '' }: PageLayoutProps) {
  return (
    <div className={`w-full px-4 sm:px-6 py-4 ${className}`}>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}