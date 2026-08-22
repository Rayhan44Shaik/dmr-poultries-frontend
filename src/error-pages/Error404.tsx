import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

export const Error404: React.FC = () => {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center h-screen text-center">
      <h1 className="text-6xl font-bold text-slate-800">404</h1>
      <p className="text-lg text-slate-600 mt-2">{t('error.page_not_found')}</p>
      <Link to="/dashboard" className="mt-4 text-blue-600 hover:underline">
        {t('error.go_dashboard')}
      </Link>
    </div>
  );
};