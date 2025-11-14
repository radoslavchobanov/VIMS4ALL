import { ReactNode, useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
} from "@mui/material";

type Updater<T> = (patch: Partial<T> | ((prev: T) => T)) => void;

export type EntityFormDialogProps<TWrite, TInitial> = {
  title: string;
  subtitle?: string[]; // Array of subtitle lines to display below title
  open: boolean;
  mode: "create" | "edit";
  initial?: TInitial;
  emptyFactory: () => TWrite;
  mapInitialToWrite?: (i: TInitial) => TWrite;
  onClose: () => void;
  onSubmit: (payload: TWrite) => Promise<void>; // you implement API call outside
  onSuccess: () => void;
  onError: (msg: string) => void;
  renderFields: (form: TWrite, setForm: Updater<TWrite>) => ReactNode;
  sidebarSlot?: ReactNode; // e.g., PhotoBox
  submitLabel?: string;
  cancelLabel?: string;
  maxWidth?: "sm" | "md" | "lg";
};

export function EntityFormDialog<TWrite extends Record<string, any>, TInitial>({
  title,
  subtitle,
  open,
  mode,
  initial,
  emptyFactory,
  mapInitialToWrite,
  onClose,
  onSubmit,
  onSuccess,
  onError,
  renderFields,
  sidebarSlot,
  submitLabel,
  cancelLabel,
  maxWidth = "md",
}: EntityFormDialogProps<TWrite, TInitial>) {
  const [form, setForm] = useState<TWrite>(emptyFactory());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initial && mapInitialToWrite) {
      setForm(mapInitialToWrite(initial));
    } else if (!initial) {
      setForm(emptyFactory());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, mode, open]);

  const update: Updater<TWrite> = (patch) => {
    setForm((prev) =>
      typeof patch === "function" ? (patch as any)(prev) : { ...prev, ...patch }
    );
  };

  const handleDialogClose = () => onClose(); // do NOT reset state here

  const handleCancel = () => {
    setForm(emptyFactory()); // explicit cancel resets
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(form);
      if (mode === "create") setForm(emptyFactory());
      onSuccess();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ??
        err?.message ??
        `Failed to ${mode === "create" ? "create" : "update"}.`;
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      keepMounted
      fullWidth
      maxWidth={maxWidth}
    >
      <DialogTitle sx={{ pb: 0 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">{title}</Typography>
            {subtitle && subtitle.length > 0 && (
              <Box sx={{ mt: 0.5 }}>
                {subtitle.map((line, idx) => (
                  <Typography
                    key={idx}
                    variant="body2"
                    sx={{ color: "text.secondary", fontSize: "0.875rem" }}
                  >
                    {line}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
          {sidebarSlot}
        </Box>
      </DialogTitle>
      <Box component="form" onSubmit={submit}>
        <DialogContent dividers sx={{ display: "grid", gap: 2 }}>
          {renderFields(form, update)}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel} disabled={submitting}>
            {cancelLabel ?? "Cancel"}
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitLabel ?? (mode === "create" ? "Create" : "Save Changes")}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
