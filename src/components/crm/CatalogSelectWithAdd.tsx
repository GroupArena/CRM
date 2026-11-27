import React, { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';

interface CatalogSelectWithAddProps {
  id: string;
  label?: string;
  value: string;
  onChange: (nextValue: string) => void;
  options: string[];
  onAddCustomOption: (newOption: string) => void;
  addOptionLabel: string;
  addPlaceholder: string;
  ariaLabel?: string;
  className?: string;
}

const ADD_NEW_SENTINEL = '__arena_add_new__';

export function CatalogSelectWithAdd({
  id,
  label,
  value,
  onChange,
  options,
  onAddCustomOption,
  addOptionLabel,
  addPlaceholder,
  ariaLabel,
  className = 'w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm',
}: CatalogSelectWithAddProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const handleConfirm = () => {
    const cleaned = draft.trim();
    if (!cleaned) return;
    onAddCustomOption(cleaned);
    onChange(cleaned);
    setDraft('');
    setAdding(false);
  };

  const handleCancel = () => {
    setDraft('');
    setAdding(false);
  };

  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-slate-700 mb-1">
          {label}
        </label>
      )}
      {adding ? (
        <div className="flex items-center gap-1.5">
          <input
            id={id}
            type="text"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
              }
            }}
            placeholder={addPlaceholder}
            aria-label={ariaLabel || label || addPlaceholder}
            className="flex-1 min-w-0 h-9 rounded-lg border border-blue-400 bg-white px-3 text-sm focus:outline-none"
          />
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!draft.trim()}
            aria-label={`Valider : ${addOptionLabel}`}
            title="Ajouter"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#19283E] text-white hover:bg-[#223552] disabled:opacity-40"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Annuler l'ajout"
            title="Annuler"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <select
            id={id}
            value={value}
            aria-label={ariaLabel || label}
            onChange={(e) => {
              if (e.target.value === ADD_NEW_SENTINEL) {
                setDraft('');
                setAdding(true);
                return;
              }
              onChange(e.target.value);
            }}
            className={className}
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            <option value={ADD_NEW_SENTINEL}>{addOptionLabel}</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setDraft('');
              setAdding(true);
            }}
            aria-label={addOptionLabel}
            title={addOptionLabel}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-[#19283E]"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
