import { useMemo } from 'react';
import { useCrm } from '../context/CrmContext';
import type { PriorityLevel, Prospect, ProspectStatus } from '../types';

export interface ProspectFilterOptions {
  search?: string;
  entityId?: string;
  status?: ProspectStatus | 'all';
  ownerUid?: string;
  tag?: string;
  priority?: PriorityLevel | 'all';
  dateFrom?: string;
  dateTo?: string;
  includeArchived?: boolean;
  sortBy?: 'updatedAt' | 'createdAt' | 'name' | 'estimatedValue' | 'lastActivityAt';
  sortDir?: 'asc' | 'desc';
}

export function useProspects(filters?: ProspectFilterOptions) {
  const {
    prospects,
    scopedProspects,
    globalSearch,
    createProspect,
    updateProspect,
    archiveProspect,
    deleteProspect,
  } = useCrm();

  const filteredProspects = useMemo(() => {
    const base = filters?.includeArchived ? prospects : scopedProspects;
    const queryText = (filters?.search ?? globalSearch).trim().toLowerCase();

    const filtered = base.filter((p) => {
      if (filters?.entityId && filters.entityId !== 'all') {
        if (
          p.primaryEntityId !== filters.entityId &&
          !p.sharedEntityIds.includes(filters.entityId)
        ) {
          return false;
        }
      }
      if (filters?.status && filters.status !== 'all' && p.status !== filters.status) {
        return false;
      }
      if (filters?.ownerUid && filters.ownerUid !== 'all' && p.ownerUid !== filters.ownerUid) {
        return false;
      }
      if (filters?.priority && filters.priority !== 'all' && p.priority !== filters.priority) {
        return false;
      }
      if (filters?.tag && filters.tag !== 'all' && !p.tags.includes(filters.tag)) {
        return false;
      }
      if (filters?.dateFrom && p.createdAt.slice(0, 10) < filters.dateFrom) {
        return false;
      }
      if (filters?.dateTo && p.createdAt.slice(0, 10) > filters.dateTo) {
        return false;
      }
      if (queryText) {
        const haystack = [
          p.firstName,
          p.lastName,
          p.companyName,
          p.email,
          p.phone,
          p.mobile,
          p.city,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(queryText)) return false;
      }
      return true;
    });

    const sortBy = filters?.sortBy ?? 'updatedAt';
    const dir = filters?.sortDir === 'asc' ? 1 : -1;

    return [...filtered].sort((a: Prospect, b: Prospect) => {
      if (sortBy === 'name') {
        return (
          `${a.lastName} ${a.firstName}`.localeCompare(
            `${b.lastName} ${b.firstName}`,
            'fr'
          ) * dir
        );
      }
      if (sortBy === 'estimatedValue') {
        return ((a.estimatedValue || 0) - (b.estimatedValue || 0)) * dir;
      }
      const valA = a[sortBy] || '';
      const valB = b[sortBy] || '';
      return valA.localeCompare(valB) * dir;
    });
  }, [prospects, scopedProspects, globalSearch, filters]);

  return {
    prospects: filteredProspects,
    allScopedProspects: scopedProspects,
    createProspect,
    updateProspect,
    archiveProspect,
    deleteProspect,
  };
}
