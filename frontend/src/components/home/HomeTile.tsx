import { Card, CardActionArea, CardContent, Typography } from "@mui/material";
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
      sx={{ display: "flex", gap: 2, alignItems: "center", minHeight: 88 }}
    >
      {icon}
      <div>
        <Typography variant="subtitle1" fontWeight={600}>
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
      variant="outlined"
      sx={{
        borderRadius: 3,
        transition: "transform .12s ease, box-shadow .12s ease",
        "&:hover": { transform: "translateY(-2px)", boxShadow: 2 },
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
