import { memo, useRef, useState } from "react";
import {
  Avatar,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
} from "@mui/material";

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
  epin?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  functionName?: string | null;
  photoUrl?: string | null;
  username?: string | null;
  uploadHandler?: (file: File) => Promise<void>;
};

export const ProfileCard = memo(function ProfileCard({
  epin,
  firstName,
  lastName,
  functionName,
  photoUrl,
  username,
  uploadHandler,
}: Props) {
  const fullName =
    `${firstName ?? ""} ${lastName ?? ""}`.trim() || username || "User";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const clickable = typeof uploadHandler === "function";

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting same file
    if (!f || !uploadHandler) return;
    try {
      setUploading(true);
      // simple client guard
      if (!f.type.startsWith("image/"))
        throw new Error("Please select an image.");
      await uploadHandler(f);
    } catch (err) {
      console.error(err);
      // optional: surface with a toast/snackbar
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Box
          sx={{
            position: "relative",
            width: 72,
            height: 72,
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <Avatar
            src={photoUrl || undefined}
            alt={fullName}
            imgProps={{ loading: "lazy" }}
            sx={{
              width: 72,
              height: 72,
              borderRadius: 2,
              fontSize: 24,
              cursor: clickable ? "pointer" : "default",
            }}
            onClick={() => clickable && fileInputRef.current?.click()}
          >
            {!photoUrl
              ? initials(firstName, lastName, username ?? undefined)
              : null}
          </Avatar>

          {/* Hover overlay when editable */}
          {clickable && !uploading && (
            <Box
              onClick={() => fileInputRef.current?.click()}
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(0,0,0,0.35)",
                color: "#fff",
                opacity: 0,
                transition: "opacity .15s ease",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 0.3,
                "&:hover": { opacity: 1 },
              }}
            >
              Change photo
            </Box>
          )}

          {/* Uploading spinner */}
          {uploading && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(255,255,255,0.6)",
              }}
            >
              <CircularProgress size={22} />
            </Box>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onPickFile}
          />
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" noWrap>
            {fullName}
          </Typography>
          {functionName && (
            <Typography variant="body2" color="text.secondary" noWrap>
              {functionName}
            </Typography>
          )}
          {epin && (
            <Typography variant="body2" color="text.secondary" noWrap>
              EPIN: {epin}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
});
