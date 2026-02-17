'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { icons } from 'lucide-react';
import { Search, X } from 'lucide-react';

// Common icons for payment methods shown by default (before searching)
const SUGGESTED_ICONS = [
  'building-2', 'banknote', 'credit-card', 'wallet', 'landmark',
  'piggy-bank', 'coins', 'dollar-sign', 'receipt', 'hand-coins',
  'circle-dollar-sign', 'badge-dollar-sign', 'bitcoin', 'gem',
  'briefcase', 'store', 'shopping-cart', 'truck', 'globe',
  'phone', 'mail', 'send', 'arrow-right-left', 'repeat',
  'check-circle', 'shield-check', 'lock', 'key', 'qr-code',
  'smartphone', 'tablet', 'monitor', 'wifi', 'zap',
  'star', 'heart', 'gift', 'tag', 'bookmark',
  'file-text', 'clipboard', 'calculator', 'percent', 'hash',
  'users', 'user', 'building', 'home', 'map-pin',
];

function toKebabCase(pascalName: string): string {
  return pascalName
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

// Build a lookup of all icons in kebab-case
const allIconEntries = Object.keys(icons).map((pascalName) => ({
  pascal: pascalName,
  kebab: toKebabCase(pascalName),
}));

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
}

export default function IconPicker({ value, onChange }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const displayedIcons = useMemo(() => {
    if (search.trim()) {
      const q = search.toLowerCase().replace(/\s+/g, '-');
      return allIconEntries
        .filter((e) => e.kebab.includes(q))
        .slice(0, 60);
    }
    // Show suggested icons
    return SUGGESTED_ICONS.map((kebab) => {
      const entry = allIconEntries.find((e) => e.kebab === kebab);
      return entry || null;
    }).filter(Boolean) as typeof allIconEntries;
  }, [search]);

  const selectedPascal = value
    ? value.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('')
    : null;
  const SelectedIcon = selectedPascal ? icons[selectedPascal as keyof typeof icons] : null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => { setIsOpen(!isOpen); setSearch(''); }}
        className="w-full flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white hover:border-gray-400 transition-colors"
      >
        {SelectedIcon ? (
          <>
            <SelectedIcon size={16} />
            <span className="flex-1 text-left">{value}</span>
          </>
        ) : (
          <span className="flex-1 text-left text-gray-400">Select an icon...</span>
        )}
        {value && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange(''); setIsOpen(false); }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search icons..."
                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>
            {!search.trim() && (
              <p className="text-xs text-gray-400 mt-1.5 px-0.5">Suggested icons. Type to search all.</p>
            )}
          </div>
          <div className="p-2 max-h-[200px] overflow-y-auto grid grid-cols-6 gap-1">
            {displayedIcons.map((entry) => {
              const Icon = icons[entry.pascal as keyof typeof icons];
              if (!Icon) return null;
              const isSelected = entry.kebab === value;
              return (
                <button
                  key={entry.kebab}
                  type="button"
                  onClick={() => { onChange(entry.kebab); setIsOpen(false); }}
                  className={`p-2 rounded flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                      : 'hover:bg-gray-100 text-gray-600'
                  }`}
                  title={entry.kebab}
                >
                  <Icon size={18} />
                </button>
              );
            })}
            {displayedIcons.length === 0 && (
              <p className="col-span-6 text-center text-sm text-gray-400 py-4">No icons found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
