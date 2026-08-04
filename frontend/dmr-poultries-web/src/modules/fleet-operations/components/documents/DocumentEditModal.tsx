import { memo, useState } from 'react';
import { X, Save, Shield, Dumbbell, FileCheck, Car, FileText, Calendar } from 'lucide-react';
import { DatePicker } from '../../../../components/common/DatePicker';
import { useSafeNotification } from '../../../../hooks/useSafeNotification';

interface DocumentEditModalProps {
  vehicle: any;
  docMap: Record<string, any>;
  docTypes?: string[];
  onClose: () => void;
  onSave: (vehicleId: string, updates: Record<string, string | null>) => Promise<void>;
}

const docConfig: Record<string, { icon: any; bg: string; border: string; text: string }> = {
  rc: { icon: FileText, bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
  insurance: { icon: Shield, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  fitness: { icon: Dumbbell, bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  permit: { icon: FileCheck, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  puc: { icon: Car, bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
};

const fallbackConfig = { icon: FileText, bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' };

const getExpiry = (doc: any): string | undefined => {
  if (doc && typeof doc === 'object') {
    return doc.expiryDate;
  }
  return undefined;
};

const normalizeDate = (input: any): string => {
  if (!input) return '';
  if (typeof input === 'string') {
    let date = new Date(input);
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
    const parts = input.split('/');
    if (parts.length === 3) {
      const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    return '';
  }
  if (input instanceof Date) {
    if (!isNaN(input.getTime())) return input.toISOString().split('T')[0];
  }
  return '';
};

const DocumentEditModal = ({ vehicle, docMap, docTypes, onClose, onSave }: DocumentEditModalProps) => {
  const { showNotification } = useSafeNotification();

  // ✅ Include ALL document types – no filter
  const documentTypes = (docTypes && docTypes.length > 0) 
    ? docTypes 
    : Object.keys(docMap);

  const initialDates: Record<string, string> = {};
  documentTypes.forEach((type) => {
    const expiry = getExpiry(docMap[type]);
    if (expiry) {
      const normalized = normalizeDate(expiry);
      if (normalized) initialDates[type] = normalized;
    }
  });

  const [editedDates, setEditedDates] = useState<Record<string, string>>(() => ({ ...initialDates }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleDateChange = (type: string, value: any) => {
    const normalized = normalizeDate(value);
    setEditedDates((prev) => ({ ...prev, [type]: normalized }));
    setErrors((prev) => ({ ...prev, [type]: '' }));
  };

  const validateChangedDates = (): boolean => {
    const newErrors: Record<string, string> = {};
    const todayStr = new Date().toISOString().split('T')[0];

    documentTypes.forEach((type) => {
      const newDate = editedDates[type];
      const oldDate = initialDates[type];
      if (newDate && newDate !== oldDate && newDate < todayStr) {
        newErrors[type] = 'Date cannot be in the past';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateChangedDates()) {
      showNotification('Please fix the errors on changed fields before saving.', 'error');
      return;
    }

    try {
      const updates: Record<string, string> = {};
      documentTypes.forEach((type) => {
        const newDate = editedDates[type];
        const oldDate = initialDates[type];
        if (newDate && newDate !== oldDate) {
          updates[type] = newDate;
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

  const getConfig = (type: string) => {
    const key = type.toLowerCase();
    return docConfig[key] || fallbackConfig;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
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

        <div className="space-y-3">
          {documentTypes.map((type) => {
            const doc = docMap[type];
            const expiry = getExpiry(doc);
            const currentDate = editedDates[type] || '';
            const error = errors[type];
            const hasExisting = !!expiry;
            const config = getConfig(type);
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

                {hasExisting && doc?.documentNumber && (
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
                {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
              </div>
            );
          })}
        </div>

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