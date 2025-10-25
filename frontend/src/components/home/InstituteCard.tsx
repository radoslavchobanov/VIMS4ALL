import { memo } from "react";
import { Card, CardContent, Typography, Box, Chip } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

type Props = {
  name: string;
  abbr?: string | null;
  imageUrl?: string | null;
  /** Visible height of the big image (px) */
  imageHeight?: number;
  /** Optional max width of the image (keeps it big but not edge-to-edge) */
  imageMaxWidth?: number | string;
  sx?: SxProps<Theme>;
};

export const InstituteCard = memo(function InstituteCard({
  name,
  abbr,
  imageUrl,
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
