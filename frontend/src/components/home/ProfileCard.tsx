import { memo } from "react";
import { Avatar, Card, CardContent, Typography, Box } from "@mui/material";

function initials(
  first?: string | null,
  last?: string | null,
  fallback?: string
) {
  const a = (first ?? "").trim();
  const b = (last ?? "").trim();
  const s = `${a} ${b}`.trim() || fallback || "U";
  return s
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

type Props = {
  firstName?: string | null;
  lastName?: string | null;
  functionName?: string | null;
  photoUrl?: string | null;
  username?: string | null; // used for initials fallback if no names
};

export const ProfileCard = memo(function ProfileCard({
  firstName,
  lastName,
  functionName,
  photoUrl,
  username,
}: Props) {
  const fullName =
    `${firstName ?? ""} ${lastName ?? ""}`.trim() || username || "User";

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Avatar
          src={photoUrl || undefined}
          alt={fullName}
          imgProps={{ loading: "lazy" }}
          sx={{ width: 72, height: 72, borderRadius: 2, fontSize: 24 }}
        >
          {!photoUrl
            ? initials(firstName, lastName, username ?? undefined)
            : null}
        </Avatar>

        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" noWrap>
            {fullName}
          </Typography>
          {functionName && (
            <Typography variant="body2" color="text.secondary" noWrap>
              {functionName}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
});
