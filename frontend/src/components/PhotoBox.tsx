import { useMemo, useState } from "react";
import {
  Box,
  Avatar,
  Tooltip,
  IconButton,
  CircularProgress,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import { api } from "../lib/apiClient";

export type PhotoBoxProps = {
  mode: "create" | "edit";
  // current image url (optional)
  src?: string | null;
  // text to fallback initials
  initialsText?: string;
  // when in edit mode, which id to use for uploads
  entityId?: string | number;
  // create the upload URL for this entity
  buildUploadUrl: (id: string | number) => string;
  // field name used by backend (default "photo")
  formFieldName?: string;
  // called with the NEW url (already cache-busted)
  onUploaded?: (newUrl: string) => void;
  // if click is blocked (e.g. create mode)
  onBlocked?: () => void;
  // client constraints
  maxSizeBytes?: number; // default 5MB
  accept?: string; // default "image/*"
  rounded?: boolean; // default true
  size?: number; // default 128
};

function toInitials(t?: string) {
  if (!t) return "";
  const parts = t.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts[1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

export function PhotoBox({
  mode,
  src,
  initialsText,
  entityId,
  buildUploadUrl,
  formFieldName = "photo",
  onUploaded,
  onBlocked,
  maxSizeBytes = 5 * 1024 * 1024,
  accept = "image/*",
  rounded = true,
  size = 128,
}: PhotoBoxProps) {
  const [busy, setBusy] = useState(false);
  const inputId = useMemo(
    () => `photo-input-${Math.random().toString(36).slice(2)}`,
    []
  );

  const handlePick = () => {
    if (mode !== "edit" || entityId == null) {
      onBlocked?.();
      return;
    }
    document.getElementById(inputId)?.click();
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || entityId == null) return;
    if (!f.type.startsWith("image/")) return;
    if (f.size > maxSizeBytes) return;

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append(formFieldName, f);
      const url = buildUploadUrl(entityId);
      const res = await api.post<{ photo_url: string }>(url, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const fresh = `${res.data.photo_url}?t=${Date.now()}`;
      onUploaded?.(fresh);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ position: "relative", width: size, height: size }}>
      <input
        id={inputId}
        type="file"
        accept={accept}
        hidden
        onChange={handleChange}
      />
      <Tooltip title={mode === "edit" ? "Change photo" : "Save first"}>
        <Box
          onClick={handlePick}
          sx={{
            cursor: mode === "edit" ? "pointer" : "not-allowed",
            width: "100%",
            height: "100%",
            borderRadius: rounded ? 2 : 1,
            overflow: "hidden",
            border: (t) => `1px solid ${t.palette.divider}`,
            position: "relative",
          }}
        >
          {src ? (
            <img
              src={src}
              alt="Entity"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Avatar
              variant={rounded ? "rounded" : "square"}
              sx={{ width: "100%", height: "100%", fontSize: 36 }}
            >
              {toInitials(initialsText)}
            </Avatar>
          )}

          <IconButton
            size="small"
            sx={{
              position: "absolute",
              bottom: 6,
              right: 6,
              bgcolor: "background.paper",
              boxShadow: 1,
              "&:hover": { bgcolor: "background.paper" },
            }}
          >
            {busy ? (
              <CircularProgress size={18} />
            ) : (
              <EditIcon fontSize="small" />
            )}
          </IconButton>
        </Box>
      </Tooltip>
    </Box>
  );
}
