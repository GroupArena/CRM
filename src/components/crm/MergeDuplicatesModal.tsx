import React, { useEffect, useState } from 'react';
import { GitMerge } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface MergeOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface MergeDuplicatesModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  options: MergeOption[];
  onConfirmMerge: (primaryId: string, duplicateId: string) => Promise<void>;
}

export function MergeDuplicatesModal({
  open,
  onClose,
  title,
  options,
  onConfirmMerge,
}: MergeDuplicatesModalProps) {
  const [primaryId, setPrimaryId] = useState('');
  const [duplicateId, setDuplicateId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPrimaryId(options[0]?.id ?? '');
    setDuplicateId(options[1]?.id ?? '');
  }, [open, options]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!primaryId || !duplicateId || primaryId === duplicateId) return;
    setSubmitting(true);
    try {
      await onConfirmMerge(primaryId, duplicateId);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle="Les informations complémentaires et liens (opportunités, devis, factures) seront transférés vers la fiche conservée."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="merge-primary" className="block text-xs font-medium text-slate-700 mb-1">
            Fiche principale à conserver *
          </label>
          <select
            id="merge-primary"
            value={primaryId}
            onChange={(e) => setPrimaryId(e.target.value)}
            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}{opt.sublabel ? ` (${opt.sublabel})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="merge-dup" className="block text-xs font-medium text-slate-700 mb-1">
            Doublon à fusionner puis supprimer *
          </label>
          <select
            id="merge-dup"
            value={duplicateId}
            onChange={(e) => setDuplicateId(e.target.value)}
            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}{opt.sublabel ? ` (${opt.sublabel})` : ''}
              </option>
            ))}
          </select>
        </div>

        {primaryId && duplicateId && primaryId === duplicateId && (
          <p className="text-xs text-red-700">
            Veuillez sélectionner deux fiches distinctes.
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting || !primaryId || !duplicateId || primaryId === duplicateId}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <GitMerge className="h-4 w-4" />
            {submitting ? 'Fusion...' : 'Confirmer la fusion'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
