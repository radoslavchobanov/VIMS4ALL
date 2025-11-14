import { Card, CardActionArea, CardContent, Typography, Box } from "@mui/material";
import { ReactNode, memo } from "react";

export const HomeTile = memo(function HomeTile({
  title,
  subtitle,
  onClick,
  icon,
}: {
  title: string;
  subtitle?: string;
  onClick?: () => void;
  icon?: ReactNode;
}) {
  const Inner = (
    <CardContent
      sx={{
        display: "flex",
        gap: 2.5,
        alignItems: "center",
        minHeight: 100,
        p: 3,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 56,
          height: 56,
          borderRadius: 2,
          background: "linear-gradient(135deg, rgba(13, 71, 161, 0.1) 0%, rgba(66, 165, 245, 0.1) 100%)",
          color: "#1565C0",
          flexShrink: 0,
          "& svg": {
            fontSize: 32,
          },
        }}
      >
        {icon}
      </Box>
      <div>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 0.5 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </div>
    </CardContent>
  );
  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 3,
        border: "1px solid",
        borderColor: "rgba(21, 101, 192, 0.12)",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        backgroundColor: "white",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "0px 8px 24px rgba(21, 101, 192, 0.15)",
          borderColor: "rgba(21, 101, 192, 0.3)",
        },
      }}
    >
      {onClick ? (
        <CardActionArea onClick={onClick}>{Inner}</CardActionArea>
      ) : (
        Inner
      )}
    </Card>
  );
});
