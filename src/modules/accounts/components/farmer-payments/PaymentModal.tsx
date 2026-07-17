import { useState, memo } from 'react';
import type { FarmerPurchase } from '../../types';
import { addFarmerPayment } from '../../services/storage';
import { useToast } from '../../hooks/useToast';

interface PaymentModalProps {
  isOpen: boolean;
  purchase: FarmerPurchase | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const PaymentModal = memo(({ isOpen, purchase, onClose, onSuccess }: PaymentModalProps) => {
  const [amount, setAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'bank' | 'upi' | 'cheque'>('cash');
  const { success, error } = useToast();

  if (!isOpen || !purchase) return null;

  const formatCurrency = (num: number) => {
    return `₹${num.toLocaleString()}`;
  };

  const handleSubmit = () => {
    if (amount <= 0) {
      error('Enter a valid amount');
      return;
    }
    const remaining = purchase.amount - purchase.paidAmount;
    if (amount > remaining) {
      error(`Amount cannot exceed remaining balance of ${formatCurrency(remaining)}`);
      return;
    }
    const result = addFarmerPayment({
      purchaseId: purchase.id,
      farmId: purchase.farmId,
      date: new Date().toISOString().split('T')[0],
      amount,
      paymentMode,
      reference: `PAY-${Date.now()}`,
      note: 'Manual payment',
    });
    if (result) {
      success('Payment recorded successfully');
      onSuccess();
      onClose();
    } else {
      error('Failed to record payment');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Record Payment</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium">Amount (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="border rounded w-full px-3 py-1"
              min="0"
              step="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Payment Mode</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as any)}
              className="border rounded w-full px-3 py-1"
            >
              <option value="cash">Cash</option>
              <option value="bank">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <button onClick={onClose} className="px-4 py-1 border rounded hover:bg-gray-100">
              Cancel
            </button>
            <button onClick={handleSubmit} className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
              Save Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
PaymentModal.displayName = 'PaymentModal';