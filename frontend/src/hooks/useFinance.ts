import { useEffect, useMemo, useState } from "react";
import {
  financeApi,
  FinanceAccount,
  LedgerEntry,
  LedgerEntryWrite,
} from "../api/finance";

export function useFinanceAccounts() {
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [loading, setLoading] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const r = await financeApi.listAccounts();
      setAccounts(r.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const cashbox = useMemo(
    () => accounts.find((a) => a.kind === "CASHBOX") ?? null,
    [accounts]
  );
  const banks = useMemo(
    () => accounts.filter((a) => a.kind === "BANK"),
    [accounts]
  );

  return { accounts, cashbox, banks, loading, reload };
}

export function useLedger(params: {
  account?: string | number;
  search?: string;
  page?: number;
}) {
  const [rows, setRows] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const r = await financeApi.listLedger(params);
      setRows(r.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.account, params.search, params.page]);

  return { rows, loading, reload };
}

export const financeMut = {
  createLedger: (p: LedgerEntryWrite) => financeApi.createLedger(p),
  patchLedger: (id: string | number, p: Partial<LedgerEntryWrite>) =>
    financeApi.patchLedger(id, p),
  deleteLedger: (id: string | number) => financeApi.deleteLedger(id),
  categoriesForAmount: (amount: number) =>
    financeApi.categoriesForAmount(amount),
  transfer: (p: Parameters<typeof financeApi.transfer>[0]) =>
    financeApi.transfer(p),
};
