import { memo, useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  delay?: number;
}

export const SearchInput = memo(({ value, onChange, placeholder = 'Search...', delay = 300 }: SearchInputProps) => {
  const [localValue, setLocalValue] = useState(value);
  const debounced = useDebounce(localValue, delay);

  useEffect(() => {
    onChange(debounced);
  }, [debounced, onChange]);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="border rounded pl-9 pr-3 py-2 w-full"
      />
    </div>
  );
});
SearchInput.displayName = 'SearchInput';