// src/modules/staff/components/salary/SalaryModalContainer.tsx

import React from 'react';
import { SalaryView } from './SalaryView';
import { SalaryEdit } from './SalaryEdit';

interface SalaryModalContainerProps {
  selectedRecordForView: any | null;
  setSelectedRecordForView: (rec: any | null) => void;
  selectedRecordForEdit: any | null;
  setSelectedRecordForEdit: (rec: any | null) => void;
  handleSaveEdit: (updatedRecord: any) => void;
  handleMarkPaid: (id: string) => void;
  month: string;
  formatCurrency: (amount: number) => string;
  confirmConfig: {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null;
  setConfirmConfig: (config: any) => void;
}

export const SalaryModalContainer: React.FC<SalaryModalContainerProps> = ({
  selectedRecordForView,
  setSelectedRecordForView,
  selectedRecordForEdit,
  setSelectedRecordForEdit,
  handleSaveEdit,
  handleMarkPaid,
  month,
  formatCurrency,
  confirmConfig,
  setConfirmConfig,
}) => {
  return (
    <>
      {selectedRecordForView && (
        <SalaryView
          record={selectedRecordForView}
          month={month}
          onMarkPaid={handleMarkPaid}
          formatCurrency={formatCurrency}
          onClose={() => setSelectedRecordForView(null)}
        />
      )}

      {selectedRecordForEdit && (
        <SalaryEdit
          isOpen={Boolean(selectedRecordForEdit)}
          record={selectedRecordForEdit}
          formatCurrency={formatCurrency}
          onClose={() => setSelectedRecordForEdit(null)}
          onSave={handleSaveEdit}
        />
      )}

      {confirmConfig?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">{confirmConfig.title}</h3>
            <p className="text-xs text-slate-600">{confirmConfig.message}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmConfig(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmConfig.onConfirm}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition shadow-xs cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};