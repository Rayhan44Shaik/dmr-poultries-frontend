import React, { Suspense } from 'react';
import { GlobalLoader } from './GlobalLoader';

interface SuspenseWrapperProps {
  children: React.ReactNode;
}

export const SuspenseWrapper: React.FC<SuspenseWrapperProps> = ({ children }) => {
  return <Suspense fallback={<GlobalLoader />}>{children}</Suspense>;
};