import { memo } from 'react';
import { addEMIPayment } from '../../services/storage';
import { useToast } from '../../hooks/useToast';

interface PayEMIModalProps {
  isOpen: boolean;
  loanId: string;
  dueDate: string;
  amount: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const PayEMIModal = memo(({ isOpen, loanId, dueDate, amount, onClose, onSuccess }: PayEMIModalProps) => {
  const { success, error } = useToast();

  if (!isOpen) return null;

  const handleSubmit = () => {
    const result = addEMIPayment({
      loanId,
      dueDate,
      paidDate: new Date().toISOString().split('T')[0],
      amount,
      status: 'Paid',
    });
    if (result) {
      success('EMI marked as Paid');
      onSuccess();
      onClose();
    } else {
      error('Failed to record EMI payment');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Confirm EMI Payment</h2>
        <p className="mb-2">Amount: ₹{amount.toLocaleString()}</p>
        <p className="mb-4">Due Date: {dueDate}</p>
        <div className="flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-1 border rounded hover:bg-gray-100">
            Cancel
          </button>
          <button onClick={handleSubmit} className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700">
            Confirm Payment
          </button>
        </div>
      </div>
    </div>
  );
});
PayEMIModal.displayName = 'PayEMIModal';