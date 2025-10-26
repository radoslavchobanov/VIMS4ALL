import { memo } from "react";
import { Card, CardContent, Typography, Box, Chip } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

type ActiveTerm = {
  id: string | number;
  name: string;
  start_date: string;
  end_date: string;
};

type Props = {
  name: string;
  abbr?: string | null;
  imageUrl?: string | null;
  activeTerm?: ActiveTerm | null;
  imageHeight?: number;
  imageMaxWidth?: number | string;
  sx?: SxProps<Theme>;
};

export const InstituteCard = memo(function InstituteCard({
  name,
  abbr,
  imageUrl,
  activeTerm,
  imageMaxWidth = 960,
  sx,
}: Props) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, ...(sx || {}) }}>
      <CardContent
        sx={{
          p: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <Typography variant="h5" sx={{ lineHeight: 1.15 }} noWrap>
          {name}
        </Typography>

        {abbr && (
          <Chip
            label={abbr}
            size="small"
            variant="outlined"
            sx={{ mt: 0.75, height: 22, "& .MuiChip-label": { px: 0.75 } }}
          />
        )}

        {activeTerm && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.75 }}
            noWrap
            aria-label="Active academic term"
            title={`Active term: ${activeTerm.name} (${activeTerm.start_date} → ${activeTerm.end_date})`}
          >
            Active term: <b>{activeTerm.name}</b>{" "}
            <span>
              ({activeTerm.start_date} – {activeTerm.end_date})
            </span>
          </Typography>
        )}

        {/* Big centered image */}
        <Box
          sx={{
            mt: 2,
            width: "100%",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Box
            component="img"
            src={imageUrl || undefined}
            alt={name}
            loading="lazy"
            sx={{
              display: "block",
              width: "70%",
              maxWidth: imageMaxWidth, // keeps it centered and “way big”
              objectFit: "cover",
              borderRadius: 2,
              border: (t) => `1px solid ${t.palette.divider}`,
              backgroundColor: "background.default",
            }}
          />
        </Box>
      </CardContent>
    </Card>
  );
});
