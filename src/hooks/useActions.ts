import { useMemo } from 'react';
import { useCrm } from '../context/CrmContext';
import { resolveEffectiveActionStatus } from '../utils/crmLogic';
import type { ActionStatus, ActionType, CrmAction } from '../types';

export interface ActionFilterOptions {
  prospectId?: string;
  entityId?: string;
  assignedToUid?: string;
  type?: ActionType | 'all';
  status?: ActionStatus | 'all';
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export function useActions(filters?: ActionFilterOptions) {
  const {
    scopedActions,
    globalSearch,
    createAction,
    updateAction,
    completeAction,
    rescheduleAction,
    cancelAction,
  } = useCrm();

  const referenceNow = new Date().toISOString();

  const enrichedActions = useMemo(() => {
    const queryText = (filters?.search ?? globalSearch).trim().toLowerCase();

    return scopedActions
      .map((a) => ({
        ...a,
        effectiveStatus: resolveEffectiveActionStatus(a, referenceNow),
      }))
      .filter((a) => {
        if (filters?.prospectId && a.prospectId !== filters.prospectId) return false;
        if (filters?.entityId && filters.entityId !== 'all' && a.entityId !== filters.entityId) {
          return false;
        }
        if (
          filters?.assignedToUid &&
          filters.assignedToUid !== 'all' &&
          a.assignedToUid !== filters.assignedToUid
        ) {
          return false;
        }
        if (filters?.type && filters.type !== 'all' && a.type !== filters.type) {
          return false;
        }
        if (filters?.status && filters.status !== 'all' && a.effectiveStatus !== filters.status) {
          return false;
        }
        if (filters?.dateFrom && a.dueDate < filters.dateFrom) return false;
        if (filters?.dateTo && a.dueDate > filters.dateTo) return false;
        if (queryText) {
          const haystack = `${a.title} ${a.description} ${a.type} ${a.outcome}`.toLowerCase();
          if (!haystack.includes(queryText)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.effectiveStatus === 'late' && b.effectiveStatus !== 'late') return -1;
        if (b.effectiveStatus === 'late' && a.effectiveStatus !== 'late') return 1;
        return `${a.dueDate} ${a.dueTime}`.localeCompare(`${b.dueDate} ${b.dueTime}`);
      });
  }, [scopedActions, globalSearch, filters, referenceNow]);

  const lateCount = useMemo(
    () =>
      scopedActions.filter(
        (a) => resolveEffectiveActionStatus(a, referenceNow) === 'late'
      ).length,
    [scopedActions, referenceNow]
  );

  return {
    actions: enrichedActions as (CrmAction & { effectiveStatus: ActionStatus })[],
    lateCount,
    createAction,
    updateAction,
    completeAction,
    rescheduleAction,
    cancelAction,
  };
}
