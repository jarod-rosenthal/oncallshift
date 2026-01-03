import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterChipProps {
  label: string;
  options: FilterOption[];
  value?: string | string[];
  onChange: (value: string | string[] | undefined) => void;
  multiple?: boolean;
  className?: string;
}

export function FilterChip({
  label,
  options,
  value,
  onChange,
  multiple = false,
  className = '',
}: FilterChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasValue = multiple
    ? Array.isArray(value) && value.length > 0
    : value !== undefined && value !== '';

  const displayLabel = hasValue
    ? multiple
      ? `${label}: ${(value as string[]).length}`
      : `${label}: ${options.find((o) => o.value === value)?.label || value}`
    : label;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    if (multiple) {
      const currentValues = (value as string[]) || [];
      if (currentValues.includes(optionValue)) {
        const newValues = currentValues.filter((v) => v !== optionValue);
        onChange(newValues.length > 0 ? newValues : undefined);
      } else {
        onChange([...currentValues, optionValue]);
      }
    } else {
      onChange(optionValue === value ? undefined : optionValue);
      setIsOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
          border transition-colors
          ${
            hasValue
              ? 'bg-primary/10 border-primary text-primary'
              : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
          }
        `}
      >
        <span className="max-w-[150px] truncate">{displayLabel}</span>
        {hasValue ? (
          <X className="w-3.5 h-3.5 hover:text-destructive" onClick={handleClear} />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[180px] max-h-[300px] overflow-auto bg-popover border border-border rounded-lg shadow-lg z-50">
          <div className="py-1">
            {options.map((option) => {
              const isSelected = multiple
                ? ((value as string[]) || []).includes(option.value)
                : value === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`
                    w-full px-3 py-2 text-left text-sm flex items-center gap-2
                    ${isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-popover-foreground'}
                  `}
                >
                  {multiple && (
                    <span
                      className={`w-4 h-4 border rounded flex items-center justify-center ${
                        isSelected ? 'bg-primary border-primary' : 'border-border'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </span>
                  )}
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default FilterChip;
