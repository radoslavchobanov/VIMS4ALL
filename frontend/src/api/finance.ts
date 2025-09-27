import { api } from "../lib/apiClient";
import {
  FIN_ACCOUNTS_ENDPOINT,
  FIN_LEDGER_ENDPOINT,
  FIN_LEDGER_TRANSFER_ENDPOINT,
  FIN_LEDGER_CATEGORIES_FOR_AMOUNT_ENDPOINT,
  FIN_ACCOUNT_TYPES_ENDPOINT,
} from "../lib/endpoints";

import { paths } from "./__generated__/vims-types";

// === Types from OpenAPI ===

// Accounts
export type FinanceAccount =
  paths["/api/finance/accounts/"]["get"]["responses"]["200"]["content"]["application/json"][number];
export type FinanceAccountWrite =
  paths["/api/finance/accounts/"]["post"]["requestBody"]["content"]["application/json"];

// Account Types
export type AccountType =
  paths["/api/finance/account-types/"]["get"]["responses"]["200"]["content"]["application/json"][number];
export type AccountTypeWrite =
  paths["/api/finance/account-types/"]["post"]["requestBody"]["content"]["application/json"];

// Ledger
export type LedgerEntry =
  paths["/api/finance/ledger/"]["get"]["responses"]["200"]["content"]["application/json"][number];
export type LedgerEntryWrite =
  paths["/api/finance/ledger/"]["post"]["requestBody"]["content"]["application/json"];

// Transfer
export type LedgerTransferWrite =
  paths["/api/finance/ledger/transfer/"]["post"]["requestBody"]["content"]["application/json"];

export const financeApi = {
  // Accounts
  listAccounts: () => api.get<FinanceAccount[]>(FIN_ACCOUNTS_ENDPOINT),
  createAccount: (p: FinanceAccountWrite) => api.post(FIN_ACCOUNTS_ENDPOINT, p),
  patchAccount: (id: string | number, p: Partial<FinanceAccountWrite>) =>
    api.patch(`${FIN_ACCOUNTS_ENDPOINT}${id}/`, p),

  // Account types
  listAccountTypes: () => api.get<AccountType[]>(FIN_ACCOUNT_TYPES_ENDPOINT),
  createAccountType: (p: AccountTypeWrite) => api.post(FIN_ACCOUNT_TYPES_ENDPOINT, p),
  patchAccountType: (id: string | number, p: Partial<AccountTypeWrite>) =>
    api.patch(`${FIN_ACCOUNT_TYPES_ENDPOINT}${id}/`, p),
  deleteAccountType: (id: string | number) =>
    api.delete(`${FIN_ACCOUNT_TYPES_ENDPOINT}${id}/`),

  // Ledger
  listLedger: (params?: { account?: string | number; search?: string; date?: string; page?: number }) =>
    api.get<LedgerEntry[]>(FIN_LEDGER_ENDPOINT, { params }),
  createLedger: (p: LedgerEntryWrite) => api.post(FIN_LEDGER_ENDPOINT, p),
  patchLedger: (id: string | number, p: Partial<LedgerEntryWrite>) =>
    api.patch(`${FIN_LEDGER_ENDPOINT}${id}/`, p),
  deleteLedger: (id: string | number) =>
    api.delete(`${FIN_LEDGER_ENDPOINT}${id}/`),

  // Helpers
  categoriesForAmount: (amount: number) =>
    api.get<AccountType[]>(FIN_LEDGER_CATEGORIES_FOR_AMOUNT_ENDPOINT, { params: { amount } }),
  transfer: (p: LedgerTransferWrite) => api.post(FIN_LEDGER_TRANSFER_ENDPOINT, p),

};
