import React, { createContext, useContext, useState, useCallback } from "react";
import { Alert, Box, Typography, Collapse, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

interface ErrorNotificationContextType {
  showError: (errors: string | string[]) => void;
  clearError: () => void;
}

const ErrorNotificationContext = createContext<
  ErrorNotificationContextType | undefined
>(undefined);

export const useErrorNotification = () => {
  const context = useContext(ErrorNotificationContext);
  if (!context) {
    throw new Error(
      "useErrorNotification must be used within ErrorNotificationProvider"
    );
  }
  return context;
};

export const ErrorNotificationProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [errors, setErrors] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const showError = useCallback((errorInput: string | string[]) => {
    const errorArray = Array.isArray(errorInput) ? errorInput : [errorInput];
    setErrors(errorArray);
    setIsOpen(true);
  }, []);

  const clearError = useCallback(() => {
    setIsOpen(false);
    // Clear errors after animation completes
    setTimeout(() => setErrors([]), 300);
  }, []);

  return (
    <ErrorNotificationContext.Provider value={{ showError, clearError }}>
      {children}

      {/* Global Error Notification - Fixed at top of viewport */}
      <Box
        sx={{
          position: "fixed",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          width: "90%",
          maxWidth: 800,
          zIndex: 9999,
        }}
      >
        <Collapse in={isOpen}>
          <Alert
            severity="error"
            variant="filled"
            action={
              <IconButton
                aria-label="close"
                color="inherit"
                size="small"
                onClick={clearError}
              >
                <CloseIcon fontSize="inherit" />
              </IconButton>
            }
            sx={{
              "& .MuiAlert-message": {
                width: "100%",
              },
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Error{errors.length > 1 ? "s" : ""}
            </Typography>
            {errors.length === 1 ? (
              <Typography variant="body2">{errors[0]}</Typography>
            ) : (
              <Box component="ul" sx={{ margin: 0, paddingLeft: 2 }}>
                {errors.map((msg, idx) => (
                  <li key={idx}>
                    <Typography variant="body2">{msg}</Typography>
                  </li>
                ))}
              </Box>
            )}
          </Alert>
        </Collapse>
      </Box>
    </ErrorNotificationContext.Provider>
  );
};
