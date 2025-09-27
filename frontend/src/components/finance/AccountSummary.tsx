import { Box, Chip, Tooltip, Typography } from "@mui/material";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";

export function formatMoney(n: number | string | undefined, currency?: string) {
  const v = Number(n ?? 0);
  const s = isNaN(v) ? String(n ?? "0") : v.toLocaleString();
  return currency ? `${s} ${currency}` : s;
}

export function AccountSummary({
  name,
  currency,
  balance,
}: {
  name: string;
  currency?: string | null;
  balance?: string | number | null;
}) {
  const num = Number(balance ?? 0);
  const color =
    isNaN(num) || num === 0 ? "default" : num < 0 ? "error" : "success";

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1.5 }}>
      <Typography
        variant="h6"
        sx={{ display: "flex", alignItems: "center", gap: 1 }}
      >
        <AccountBalanceWalletIcon fontSize="small" />
        {name}
      </Typography>

      <Tooltip title="Current balance (sum of ledger entries)">
        <Chip
          label={`Balance: ${formatMoney(balance ?? 0, currency ?? undefined)}`}
          color={color}
          size="small"
          sx={{ fontWeight: 600 }}
        />
      </Tooltip>

      {/* {currency && (
        <Chip
          label={`Currency: ${currency}`}
          size="small"
          variant="outlined"
          sx={{ ml: 1 }}
        />
      )} */}
    </Box>
  );
}
