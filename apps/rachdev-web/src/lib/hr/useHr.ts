'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { hr, type HrEntity } from '@rach/ui/lib/api';

/**
 * Fetch one or more HR entities for the current tenant from /api/hr.
 * `get<T>(entity)` returns the typed array (empty until loaded).
 */
export function useHr(entities: HrEntity[]) {
  const { token } = useAuth();
  const [data, setData] = useState<Record<string, unknown[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const key = entities.join(',');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError('');
      const results = await Promise.all(entities.map((e) => hr.list(e, token)));
      const map: Record<string, unknown[]> = {};
      entities.forEach((e, i) => { map[e] = results[i]; });
      setData(map);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, key]);

  useEffect(() => { load(); }, [load]);

  const get = <T,>(entity: HrEntity): T[] => (data[entity] as T[] | undefined) ?? [];
  return { get, loading, error, reload: load, setLoading };
}
