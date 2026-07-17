import { useState, memo } from 'react';
import { addCashEntry } from '../../services/storage';
import { useToast } from '../../hooks/useToast';

interface CashEntryFormProps {
  date: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const CashEntryForm = memo(({ date, onSuccess, onCancel }: CashEntryFormProps) => {
  const [particulars, setParticulars] = useState('');
  const [receipt, setReceipt] = useState(0);
  const [payment, setPayment] = useState(0);
  const [mode, setMode] = useState<'cash' | 'bank' | 'upi' | 'card'>('cash');
  const { success, error } = useToast();

  const handleSubmit = () => {
    if (!particulars || (receipt === 0 && payment === 0)) {
      error('Fill in particulars and amount');
      return;
    }
    const result = addCashEntry({
      date,
      particulars,
      receipt,
      payment,
      mode,
      contraType: 'other',
      contraId: `manual-${Date.now()}`,
    });
    if (result) {
      success('Entry added');
      onSuccess();
    } else {
      error('Failed to add entry');
    }
  };

  return (
    <div className="bg-gray-50 p-4 rounded border mb-4 grid grid-cols-1 md:grid-cols-5 gap-2">
      <input
        type="text"
        placeholder="Particulars"
        className="border rounded px-2 py-1"
        value={particulars}
        onChange={(e) => setParticulars(e.target.value)}
      />
      <input
        type="number"
        placeholder="Receipt"
        className="border rounded px-2 py-1"
        value={receipt || ''}
        onChange={(e) => setReceipt(Number(e.target.value))}
        min="0"
      />
      <input
        type="number"
        placeholder="Payment"
        className="border rounded px-2 py-1"
        value={payment || ''}
        onChange={(e) => setPayment(Number(e.target.value))}
        min="0"
      />
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as any)}
        className="border rounded px-2 py-1"
      >
        <option value="cash">Cash</option>
        <option value="bank">Bank</option>
        <option value="upi">UPI</option>
        <option value="card">Card</option>
      </select>
      <div className="flex space-x-2">
        <button onClick={handleSubmit} className="bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700">
          Save
        </button>
        <button onClick={onCancel} className="bg-gray-300 rounded px-3 py-1 hover:bg-gray-400">
          Cancel
        </button>
      </div>
    </div>
  );
});
CashEntryForm.displayName = 'CashEntryForm';