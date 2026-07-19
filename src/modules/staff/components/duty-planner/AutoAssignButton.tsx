// src/modules/staff/components/duty-planner/AutoAssignButton.tsx

import { memo } from 'react';
import { Wand2 } from 'lucide-react';

interface AutoAssignButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

function AutoAssignButton({ onClick, disabled }: AutoAssignButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-sm font-medium shadow-sm transition active:scale-95"
    >
      <Wand2 size={16} />
      Auto Assign
    </button>
  );
}

export default memo(AutoAssignButton);