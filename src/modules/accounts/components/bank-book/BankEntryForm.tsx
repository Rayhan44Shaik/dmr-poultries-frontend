import { useState, memo } from 'react';
import { addBankEntry } from '../../services/storage';
import { useToast } from '../../hooks/useToast';

interface BankEntryFormProps {
  date: string;
  bankAccountId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const BankEntryForm = memo(({ date, bankAccountId, onSuccess, onCancel }: BankEntryFormProps) => {
  const [particulars, setParticulars] = useState('');
  const [deposit, setDeposit] = useState(0);
  const [withdrawal, setWithdrawal] = useState(0);
  const { success, error } = useToast();

  const handleSubmit = () => {
    if (!particulars || (deposit === 0 && withdrawal === 0)) {
      error('Fill in particulars and amount');
      return;
    }
    const result = addBankEntry({
      date,
      particulars,
      deposit,
      withdrawal,
      bankAccountId,
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
    <div className="bg-gray-50 p-4 rounded border mb-4 grid grid-cols-1 md:grid-cols-4 gap-2">
      <input
        type="text"
        placeholder="Particulars"
        className="border rounded px-2 py-1"
        value={particulars}
        onChange={(e) => setParticulars(e.target.value)}
      />
      <input
        type="number"
        placeholder="Deposit"
        className="border rounded px-2 py-1"
        value={deposit || ''}
        onChange={(e) => setDeposit(Number(e.target.value))}
        min="0"
      />
      <input
        type="number"
        placeholder="Withdrawal"
        className="border rounded px-2 py-1"
        value={withdrawal || ''}
        onChange={(e) => setWithdrawal(Number(e.target.value))}
        min="0"
      />
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
BankEntryForm.displayName = 'BankEntryForm';