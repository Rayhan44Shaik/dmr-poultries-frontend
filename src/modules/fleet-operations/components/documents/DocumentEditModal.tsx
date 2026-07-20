import { memo, useState } from 'react';
import { X, Save, Shield, Dumbbell, FileCheck, Car, FileText, Calendar } from 'lucide-react';
import { DatePicker } from '../../../../components/common/DatePicker';
import { useSafeNotification } from '../../../../hooks/useSafeNotification';

interface DocumentEditModalProps {
  vehicle: any;
  docMap: Record<string, any>;
  onClose: () => void;
  onSave: (vehicleId: string, updates: Record<string, string | null>) => Promise<void>;
}

// Map document type to icon and colour scheme
const docConfig: Record<string, { icon: any; bg: string; border: string; text: string }> = {
  insurance: { icon: Shield, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  fitness: { icon: Dumbbell, bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  permit: { icon: FileCheck, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  puc: { icon: Car, bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  rc: { icon: FileText, bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
};

const DocumentEditModal = ({ vehicle, docMap, onClose, onSave }: DocumentEditModalProps) => {
  const { showNotification } = useSafeNotification();

  // ... (all existing state and logic unchanged) ...
  const [editedDates, setEditedDates] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    Object.entries(docMap).forEach(([type, doc]) => {
      if (doc && doc.expiryDate) {
        const dateObj = new Date(doc.expiryDate);
        if (!isNaN(dateObj.getTime())) {
          initial[type] = dateObj.toISOString().split('T')[0];
        } else {
          const parts = doc.expiryDate.split('-');
          if (parts.length === 3) {
            const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            if (!isNaN(d.getTime())) {
              initial[type] = d.toISOString().split('T')[0];
            }
          }
        }
      }
    });
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleDateChange = (type: string, value: string) => {
    setEditedDates((prev) => ({ ...prev, [type]: value }));
    setErrors((prev) => ({ ...prev, [type]: '' }));
  };

  const validateDates = (): boolean => {
    const newErrors: Record<string, string> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    Object.entries(editedDates).forEach(([type, dateStr]) => {
      if (dateStr) {
        const selectedDate = new Date(dateStr + 'T00:00:00');
        if (selectedDate < today) {
          newErrors[type] = 'Date cannot be in the past';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateDates()) {
      showNotification('Please fix the errors before saving', 'error');
      return;
    }

    try {
      const updates: Record<string, string> = {};
      Object.entries(editedDates).forEach(([type, dateStr]) => {
        const existing = docMap[type]?.expiryDate;
        if (dateStr) {
          const formatted = new Date(dateStr + 'T00:00:00').toISOString().split('T')[0];
          const existingFormatted = existing
            ? new Date(existing).toISOString().split('T')[0]
            : null;
          if (formatted !== existingFormatted) {
            updates[type] = dateStr;
          }
        }
      });

      if (Object.keys(updates).length === 0) {
        showNotification('No changes to save', 'info');
        return;
      }

      await onSave(vehicle.id, updates);
      showNotification('Document dates updated successfully', 'success');
      onClose();
    } catch (error) {
      showNotification('Failed to update documents', 'error');
    }
  };

  const documentTypes = Object.keys(docMap);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 pb-2 border-b border-gray-100">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-600" />
              Edit Documents
            </h2>
            <p className="text-sm text-gray-500 mt-1">{vehicle.vehicleNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Document rows */}
        <div className="space-y-3">
          {documentTypes.map((type) => {
            const doc = docMap[type];
            const currentDate = editedDates[type] || '';
            const error = errors[type];
            const hasExisting = !!doc;
            const config = docConfig[type] || { icon: FileText, bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' };
            const Icon = config.icon;

            return (
              <div
                key={type}
                className={`rounded-xl border ${config.border} ${config.bg} p-4 transition hover:shadow-sm`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2 sm:w-32">
                    <div className={`p-1.5 rounded-full ${config.bg} border ${config.border}`}>
                      <Icon className={`w-4 h-4 ${config.text}`} />
                    </div>
                    <span className={`font-semibold capitalize ${config.text}`}>{type}</span>
                  </div>

                  <div className="flex-1 flex justify-end">
                    <div className="w-full sm:w-60 relative flex justify-end [zoom:0.9] [&_div.absolute]:right-0 [&_div.absolute]:left-auto">
                      <DatePicker
                        value={currentDate}
                        onChange={(val) => handleDateChange(type, val)}
                        placeholder={hasExisting ? 'Update date' : 'Add date'}
                        disabled={false}
                        error={error}
                        className="w-full text-xs"
                      />
                    </div>
                  </div>
                </div>

                {hasExisting && doc.documentNumber && (
                  <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Document #: {doc.documentNumber}
                  </div>
                )}
                {!hasExisting && (
                  <div className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                    <Car className="w-3 h-3" />
                    No document on file – pick a date to add one.
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer buttons */}
        <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium flex items-center gap-2 shadow-sm"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(DocumentEditModal);