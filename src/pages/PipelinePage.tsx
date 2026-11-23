import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Plus, GripVertical, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCrm } from '../context/CrmContext';
import { useAuth } from '../hooks/useAuth';
import type { Deal, LostReason, PipelineStage } from '../types';
import { DealFormModal } from '../components/crm/DealFormModal';
import { LossReasonModal } from '../components/crm/LossReasonModal';
import { formatCurrency, formatDateFr } from '../utils/crmLogic';

function DealCard({
  deal,
  stages,
  clientLabel,
  clientLink,
  canWrite,
  onSelect,
  onMoveStage,
}: {
  deal: Deal;
  stages: PipelineStage[];
  clientLabel: string;
  clientLink: string;
  canWrite: boolean;
  onSelect: (deal: Deal) => void;
  onMoveStage: (dealId: string, stageId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    disabled: !canWrite,
  });

  const style: React.CSSProperties | undefined = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs space-y-2 ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onSelect(deal)}
          className="text-left text-sm font-semibold text-slate-900 hover:text-blue-600 leading-snug"
        >
          {deal.name}
        </button>
        {canWrite && (
          <button
            type="button"
            aria-label={`Déplacer ${deal.name}`}
            className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing p-0.5 shrink-0"
            {...listeners}
            {...attributes}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
      </div>

      <Link
        to={clientLink}
        className="block text-xs text-slate-500 hover:text-blue-600 truncate"
      >
        {clientLabel}
      </Link>

      {deal.status === 'lost' && deal.lostReason && (
        <p className="text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded px-2 py-0.5">
          Motif : {deal.lostReason}
        </p>
      )}

      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
        <span className="font-sans tabular-nums font-bold text-slate-900">
          {formatCurrency(deal.amount, deal.currency)}
        </span>
        <span className="font-sans tabular-nums text-slate-500">
          {deal.probability}% · {formatDateFr(deal.expectedCloseDate)}
        </span>
      </div>

      {canWrite && (
        <div>
          <label htmlFor={`move-${deal.id}`} className="sr-only">
            Changer l'étape de {deal.name}
          </label>
          <select
            id={`move-${deal.id}`}
            value={deal.stageId}
            onChange={(e) => onMoveStage(deal.id, e.target.value)}
            className="w-full h-7 rounded border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
          >
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                Étape : {s.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function StageColumn({
  stage,
  deals,
  allStages,
  getClientInfo,
  canWrite,
  onSelectDeal,
  onMoveStage,
}: {
  stage: PipelineStage;
  deals: Deal[];
  allStages: PipelineStage[];
  getClientInfo: (deal: Deal) => { label: string; link: string };
  canWrite: boolean;
  onSelectDeal: (deal: Deal) => void;
  onMoveStage: (dealId: string, stageId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const columnTotal = deals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`w-64 shrink-0 rounded-xl border p-3 flex flex-col gap-3 transition-colors ${
        isOver
          ? 'border-[#C9A125] bg-[#C9A125]/10'
          : 'border-[#E1E4EA] bg-[#E1E4EA]/45'
      }`}
    >
      <div className="px-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 truncate">
            {stage.name}
          </h2>
          <span className="text-xs font-sans tabular-nums text-slate-500">
            {stage.probability}%
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-slate-600 font-sans tabular-nums">
          <span>
            {deals.length} opp.
          </span>
          <span className="font-semibold text-slate-800">
            {formatCurrency(columnTotal)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 min-h-[120px]">
        {deals.map((deal) => {
          const info = getClientInfo(deal);
          return (
            <DealCard
              key={deal.id}
              deal={deal}
              stages={allStages}
              clientLabel={info.label}
              clientLink={info.link}
              canWrite={canWrite}
              onSelect={onSelectDeal}
              onMoveStage={onMoveStage}
            />
          );
        })}
      </div>
    </div>
  );
}

export function PipelinePage() {
  const {
    authorizedEntities,
    selectedEntityId,
    pipelines,
    stages,
    scopedDeals,
    prospects,
    contacts,
    companies,
    moveDealToStage,
  } = useCrm();
  const { canWriteCrm } = useAuth();

  const [pipelineEntityId, setPipelineEntityId] = useState<string>(
    selectedEntityId !== 'all'
      ? selectedEntityId
      : authorizedEntities[0]?.id ?? 'arena-business-center'
  );
  const [activeDragDealId, setActiveDragDealId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [pendingLossMove, setPendingLossMove] = useState<{
    deal: Deal;
    targetStageId: string;
  } | null>(null);

  const effectiveEntityId =
    selectedEntityId !== 'all' ? selectedEntityId : pipelineEntityId;

  const activePipeline = useMemo(
    () => pipelines.find((p) => p.entityId === effectiveEntityId) ?? pipelines[0],
    [pipelines, effectiveEntityId]
  );

  const activeStages = useMemo(
    () =>
      [...stages]
        .filter(
          (s) =>
            s.entityId === effectiveEntityId ||
            (activePipeline && s.pipelineId === activePipeline.id)
        )
        .sort((a, b) => a.order - b.order),
    [stages, effectiveEntityId, activePipeline]
  );

  const entityDeals = useMemo(
    () => scopedDeals.filter((d) => d.entityId === effectiveEntityId),
    [scopedDeals, effectiveEntityId]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const requestStageMove = (dealId: string, targetStageId: string) => {
    const deal = entityDeals.find((d) => d.id === dealId);
    const stage = activeStages.find((s) => s.id === targetStageId);
    if (!deal || !stage || deal.stageId === targetStageId) return;
    if (stage.outcomeType === 'lost') {
      setPendingLossMove({ deal, targetStageId });
      return;
    }
    moveDealToStage(dealId, targetStageId);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragDealId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragDealId(null);
    const { active, over } = event;
    if (!over) return;
    requestStageMove(String(active.id), String(over.id));
  };

  const getClientInfo = (deal: Deal): { label: string; link: string } => {
    const comp = companies.find((c) => c.id === deal.companyId);
    const ct = contacts.find((c) => c.id === deal.contactId);
    if (ct) {
      return {
        label: `${ct.fullName}${comp ? ` · ${comp.tradeName || comp.legalName}` : ''}`,
        link: `/contacts/${ct.id}`,
      };
    }
    const p = prospects.find((item) => item.id === deal.prospectId);
    if (p) {
      return {
        label: `${p.firstName} ${p.lastName}${p.companyName ? ` · ${p.companyName}` : ''}`,
        link: `/prospects/${p.id}`,
      };
    }
    return { label: comp?.legalName ?? 'Client', link: comp ? `/companies/${comp.id}` : '/pipeline' };
  };

  const draggingDeal = entityDeals.find((d) => d.id === activeDragDealId);
  const totalPipelineAmount = entityDeals
    .filter((d) => d.status === 'open')
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#19283E]">
            Pipeline commercial (6 étapes)
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-sans tabular-nums">
            Portefeuille ouvert : {formatCurrency(totalPipelineAmount)} · {entityDeals.length} opportunité
            {entityDeals.length > 1 ? 's' : ''}
          </p>
        </div>

        {canWriteCrm && (
          <button
            type="button"
            onClick={() => {
              setEditingDeal(null);
              setModalOpen(true);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552] whitespace-nowrap"
          >
            <Plus className="h-4 w-4 text-[#C9A125]" />
            Nouvelle opportunité
          </button>
        )}
      </div>

      {selectedEntityId === 'all' && (
        <div
          role="tablist"
          aria-label="Choisir le pipeline par entité"
          className="flex items-center gap-2 overflow-x-auto pb-1"
        >
          {authorizedEntities.map((entity) => (
            <button
              key={entity.id}
              type="button"
              role="tab"
              aria-selected={effectiveEntityId === entity.id}
              onClick={() => setPipelineEntityId(entity.id)}
              className={`h-9 rounded-lg border px-3.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                effectiveEntityId === entity.id
                  ? 'border-[#19283E] bg-[#19283E] text-white'
                  : 'border-[#E1E4EA] bg-white text-[#19283E] hover:bg-[#E1E4EA]/40'
              }`}
            >
              {entity.name}
            </button>
          ))}
        </div>
      )}

      {activeStages.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          <Briefcase className="h-8 w-8 mx-auto text-slate-400 mb-2" />
          Aucune étape configurée pour ce pipeline.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {activeStages.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                allStages={activeStages}
                deals={entityDeals.filter((d) => d.stageId === stage.id)}
                getClientInfo={getClientInfo}
                canWrite={canWriteCrm}
                onSelectDeal={(deal) => {
                  setEditingDeal(deal);
                  setModalOpen(true);
                }}
                onMoveStage={requestStageMove}
              />
            ))}
          </div>

          <DragOverlay>
            {draggingDeal ? (
              <div className="w-72 rounded-lg border border-blue-400 bg-white p-3.5 shadow-lg">
                <p className="text-sm font-semibold text-slate-900">
                  {draggingDeal.name}
                </p>
                <p className="text-xs font-sans tabular-nums text-slate-600 mt-1">
                  {formatCurrency(draggingDeal.amount, draggingDeal.currency)}
                </p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <DealFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultEntityId={effectiveEntityId}
        initialDeal={editingDeal}
      />

      <LossReasonModal
        open={Boolean(pendingLossMove)}
        dealName={pendingLossMove?.deal.name ?? ''}
        onClose={() => setPendingLossMove(null)}
        onConfirm={async (lostReason: LostReason, lostComment: string) => {
          if (!pendingLossMove) return;
          await moveDealToStage(pendingLossMove.deal.id, pendingLossMove.targetStageId, {
            lostReason,
            lostComment,
          });
        }}
      />
    </div>
  );
}
