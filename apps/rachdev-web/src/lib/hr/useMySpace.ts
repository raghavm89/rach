'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { hr } from '@rach/ui/lib/api';
import type { Employee, LeaveRequest, Letter, PayslipRecord, HrTicket, LeaveBalance } from '@/lib/hr/demo';

export interface MySpace {
  employee: Employee | null;
  leave: LeaveRequest[];
  letters: Letter[];
  payslips: PayslipRecord[];
  tickets: HrTicket[];
  balance: LeaveBalance | null;
}

/** Fetch the signed-in employee's own record + records from /api/hr/me. */
export function useMySpace() {
  const { token } = useAuth();
  const [data, setData] = useState<MySpace>({ employee: null, leave: [], letters: [], payslips: [], tickets: [], balance: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError('');
      const r = await hr.mySpace(token);
      setData({
        employee: (r.employee as Employee) ?? null,
        leave: (r.leave as LeaveRequest[]) ?? [],
        letters: (r.letters as Letter[]) ?? [],
        payslips: (r.payslips as PayslipRecord[]) ?? [],
        tickets: (r.tickets as HrTicket[]) ?? [],
        balance: (r.balance as LeaveBalance) ?? null,
      });
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  return { ...data, loading, error, reload: load, setLoading };
}
