import { ReactNode, useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
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
  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  useEffect(() => {
    if (initial && mapInitialToWrite) {
      setForm(mapInitialToWrite(initial));
    } else if (!initial) {
      setForm(emptyFactory());
    }
    // Clear errors when dialog opens or mode changes
    setErrorMessages([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, mode, open]);

  const update: Updater<TWrite> = (patch) => {
    // Clear errors when user modifies form
    if (errorMessages.length > 0) {
      setErrorMessages([]);
    }
    setForm((prev) =>
      typeof patch === "function" ? (patch as any)(prev) : { ...prev, ...patch }
    );
  };

  const handleDialogClose = () => onClose(); // do NOT reset state here

  const handleCancel = () => {
    setForm(emptyFactory()); // explicit cancel resets
    onClose();
  };

  // Helper function to parse DRF validation errors
  const parseDrfErrors = (err: any): string[] => {
    const data = err?.response?.data;

    if (typeof data === "string") return [data];
    if (Array.isArray(data)) return data.map(String);

    if (data && typeof data === "object") {
      const errors: string[] = [];

      // Handle top-level "detail" field
      if (data.detail) {
        errors.push(String(data.detail));
      }

      // Handle field-specific errors
      for (const [field, value] of Object.entries(data)) {
        if (field === "detail") continue;

        // Check if this is a global error
        const isGlobal = field === "__all__" || field === "non_field_errors";

        if (Array.isArray(value)) {
          value.forEach((msg: any) => {
            errors.push(isGlobal ? String(msg) : `${field}: ${String(msg)}`);
          });
        } else if (typeof value === "string") {
          errors.push(isGlobal ? value : `${field}: ${value}`);
        } else if (value && typeof value === "object") {
          // Handle nested errors
          for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, any>)) {
            if (Array.isArray(nestedValue)) {
              nestedValue.forEach((msg: any) => {
                errors.push(`${field}.${nestedKey}: ${String(msg)}`);
              });
            } else {
              errors.push(`${field}.${nestedKey}: ${String(nestedValue)}`);
            }
          }
        }
      }

      return errors.length ? errors : ["Validation failed."];
    }

    return [err?.message ?? `Failed to ${mode === "create" ? "create" : "update"}.`];
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessages([]); // Clear previous errors
    try {
      await onSubmit(form);
      if (mode === "create") setForm(emptyFactory());
      onSuccess();
    } catch (err: any) {
      const errors = parseDrfErrors(err);
      setErrorMessages(errors);
      // Also call the original onError for backward compatibility (e.g., toast notifications)
      onError(errors.join("; "));
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
          {/* Error Alert Box */}
          {errorMessages.length > 0 && (
            <Alert
              severity="error"
              variant="filled"
              onClose={() => setErrorMessages([])}
              sx={{
                mb: 1,
                "& .MuiAlert-message": {
                  width: "100%",
                },
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Validation Error{errorMessages.length > 1 ? "s" : ""}
              </Typography>
              {errorMessages.length === 1 ? (
                <Typography variant="body2">{errorMessages[0]}</Typography>
              ) : (
                <Box component="ul" sx={{ margin: 0, paddingLeft: 2 }}>
                  {errorMessages.map((msg, idx) => (
                    <li key={idx}>
                      <Typography variant="body2">{msg}</Typography>
                    </li>
                  ))}
                </Box>
              )}
            </Alert>
          )}

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
