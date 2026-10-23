import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ChevronDown, X, Loader2 } from 'lucide-react';

/**
 * Reusable Select2-style Searchable Dropdown Component
 * Features:
 * - Local text search filtering & Remote live async search (via onSearch prop)
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Click outside detection to auto-close
 * - Clearable selection
 * - Custom option rendering
 * - Disabled & custom styling support
 */
const SearchSelect = ({
  options = [], // Array of { value, label, sublabel, ... } or custom objects
  value, // Selected value
  onChange, // Callback function (selectedOption)
  onSearch = null, // Optional async/sync search function: (query) => Promise<Array> | Array
  placeholder = 'Pilih opsi...',
  searchPlaceholder = 'Cari...',
  disabled = false,
  className = '',
  clearable = false,
  maxVisibleOptions = 60,
  renderOption = null // Custom render function: (option) => ReactNode
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [remoteOptions, setRemoteOptions] = useState(null);
  const [isRemoteLoading, setIsRemoteLoading] = useState(false);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Active pool of options (remote if onSearch is active and returned results, otherwise options prop)
  const activeOptions = remoteOptions !== null ? remoteOptions : options;

  // Ensure current selected option is always findable even if remote search pruned it
  const selectedOption = React.useMemo(() => {
    const foundInActive = activeOptions.find((opt) => String(opt.value) === String(value));
    if (foundInActive) return foundInActive;
    return options.find((opt) => String(opt.value) === String(value));
  }, [activeOptions, options, value]);

  // High-performance multi-term search filtering for local mode
  const filteredOptions = React.useMemo(() => {
    if (onSearch) {
      // Remote search handles filtering on the server
      return activeOptions;
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;

    const terms = q.split(/\s+/).filter(Boolean);
    return options.filter((opt) => {
      const searchTarget = `${opt.label || ''} ${opt.sublabel || ''} ${opt.searchTerms || ''}`.toLowerCase();
      return terms.every(term => searchTarget.includes(term));
    });
  }, [options, activeOptions, searchQuery, onSearch]);

  const displayedOptions = React.useMemo(() => {
    return filteredOptions.slice(0, maxVisibleOptions);
  }, [filteredOptions, maxVisibleOptions]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle remote search debounce
  useEffect(() => {
    if (!isOpen || !onSearch) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        setIsRemoteLoading(true);
        const results = await onSearch(searchQuery);
        if (Array.isArray(results)) {
          setRemoteOptions(results);
        }
      } catch (err) {
        console.error('SearchSelect remote search error:', err);
      } finally {
        setIsRemoteLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchQuery, isOpen, onSearch]);

  // Reset search query and highlighted index when dropdown is opened/closed
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setHighlightedIndex(0);
      setRemoteOptions(null);
      // Auto-focus search input
      setTimeout(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
      }, 50);
    }
  }, [isOpen]);

  // Keyboard navigation logic
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const spaceBelow = window.innerHeight - rect.bottom;
          setOpenUpwards(spaceBelow < 280 && rect.top > 280);
        }
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => 
          prev < displayedOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (displayedOptions[highlightedIndex]) {
          handleSelect(displayedOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  const handleSelect = (opt) => {
    if (onChange) onChange(opt);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) onChange(null);
  };

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className={`relative w-full text-left ${className}`}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            if (!isOpen && containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect();
              const spaceBelow = window.innerHeight - rect.bottom;
              setOpenUpwards(spaceBelow < 280 && rect.top > 280);
            }
            setIsOpen(!isOpen);
          }
        }}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm transition-all focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none select-none cursor-pointer ${
          disabled ? 'opacity-60 cursor-not-allowed bg-zinc-100' : ''
        } ${isOpen ? 'ring-2 ring-indigo-500/20 border-indigo-600 bg-white' : ''}`}
      >
        <div className={`truncate flex-1 ${!selectedOption ? 'text-zinc-400' : 'text-zinc-800'}`}>
          {selectedOption ? (
            <div>
              <div className="font-semibold text-xs sm:text-sm text-zinc-900 truncate">
                {selectedOption.label}
              </div>
              {selectedOption.sublabel && (
                <div className="text-[11px] text-zinc-500 font-normal truncate mt-0.5">
                  {selectedOption.sublabel}
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs sm:text-sm">{placeholder}</span>
          )}
        </div>
        
        <div className="flex items-center space-x-1.5 shrink-0 ml-2">
          {clearable && selectedOption && !disabled && (
            <span
              onClick={handleClear}
              className="p-1 rounded-full text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 transition-all cursor-pointer"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-zinc-600' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className={`absolute z-[100] w-full bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[320px] ${
          openUpwards ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
        }`}>
          {/* Search Box */}
          <div className="p-2 border-b border-zinc-100 flex items-center bg-zinc-50 shrink-0">
            {isRemoteLoading ? (
              <Loader2 size={15} className="text-indigo-600 ml-2 animate-spin shrink-0" />
            ) : (
              <Search size={15} className="text-zinc-400 ml-2 shrink-0" />
            )}
            <input
              ref={searchInputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-0 pl-2 pr-3 py-1.5 text-xs text-zinc-700 placeholder-zinc-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 rounded-full hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="flex-1 overflow-y-auto py-1.5 max-h-[230px]">
            {displayedOptions.length === 0 ? (
              <div className="px-4 py-4 text-center text-xs text-zinc-400 font-semibold select-none">
                Tidak ada opsi ditemukan
              </div>
            ) : (
              displayedOptions.map((opt, idx) => {
                const isSelected = value === opt.value;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`px-4 py-2.5 text-sm transition-all cursor-pointer border-b border-zinc-50 last:border-0 ${
                      isSelected 
                        ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                        : isHighlighted 
                          ? 'bg-zinc-50 text-zinc-900' 
                          : 'text-zinc-700 hover:bg-zinc-50/70'
                    }`}
                  >
                    {renderOption ? (
                      renderOption(opt)
                    ) : (
                      <div>
                        <div className="font-semibold text-xs sm:text-sm text-zinc-900 truncate">
                          {opt.label}
                        </div>
                        {opt.sublabel && (
                          <div className={`text-[11px] mt-0.5 truncate ${isSelected ? 'text-indigo-600/80 font-medium' : 'text-zinc-500'}`}>
                            {opt.sublabel}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Info if results exceed limit */}
          {filteredOptions.length > maxVisibleOptions && (
            <div className="px-3 py-1.5 bg-zinc-50 border-t border-zinc-100 text-[10px] text-zinc-400 text-center font-medium">
              Menampilkan {maxVisibleOptions} dari {filteredOptions.length.toLocaleString('id-ID')} hasil. Ketik untuk menyaring.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchSelect;
