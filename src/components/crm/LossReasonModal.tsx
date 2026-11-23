import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { LOST_REASONS, type LostReason } from '../../types';

interface LossReasonModalProps {
  open: boolean;
  dealName: string;
  onClose: () => void;
  onConfirm: (lostReason: LostReason, lostComment: string) => Promise<void>;
}

export function LossReasonModal({
  open,
  dealName,
  onClose,
  onConfirm,
}: LossReasonModalProps) {
  const [lostReason, setLostReason] = useState<LostReason>('Prix');
  const [lostComment, setLostComment] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLostReason('Prix');
    setLostComment('');
    setErrorMsg(null);
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lostReason === 'Autre' && !lostComment.trim()) {
      setErrorMsg('Un commentaire explicatif est obligatoire lorsque le motif est « Autre ».');
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(lostReason, lostComment.trim());
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Motif de perte obligatoire"
      subtitle={`Opportunité : ${dealName}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {errorMsg && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        <div>
          <label htmlFor="loss-reason-select" className="block text-xs font-medium text-slate-700 mb-1">
            Motif principal *
          </label>
          <select
            id="loss-reason-select"
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value as LostReason)}
            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            {LOST_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="loss-comment" className="block text-xs font-medium text-slate-700 mb-1">
            Commentaire {lostReason === 'Autre' ? '*' : '(optionnel)'}
          </label>
          <textarea
            id="loss-comment"
            rows={3}
            value={lostComment}
            onChange={(e) => setLostComment(e.target.value)}
            placeholder="Précisez le contexte de la décision client..."
            className="w-full rounded-lg border border-slate-200 p-3 text-sm"
            required={lostReason === 'Autre'}
          />
        </div>

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
            disabled={submitting}
            className="h-9 rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? 'Enregistrement...' : 'Confirmer la perte'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
