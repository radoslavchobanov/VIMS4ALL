import { createTheme } from "@mui/material/styles";

// Color palette inspired by VIMS4ALL logo
// The logo features dark blue to light blue gradient
const colors = {
  primary: {
    main: "#1565C0", // Dark blue - professional and trustworthy
    light: "#42A5F5",
    dark: "#0D47A1",
    contrastText: "#FFFFFF",
  },
  secondary: {
    main: "#64B5F6", // Light blue - modern and fresh
    light: "#90CAF9",
    dark: "#42A5F5",
    contrastText: "#FFFFFF",
  },
  accent: {
    main: "#FF6B35", // Warm orange for CTAs and highlights
    light: "#FF8A5B",
    dark: "#E65527",
  },
  background: {
    default: "#F8FAFC", // Very light blue-gray
    paper: "#FFFFFF",
    elevated: "#FFFFFF",
  },
  text: {
    primary: "#1E293B", // Dark slate
    secondary: "#64748B", // Medium slate
    disabled: "#CBD5E1",
  },
  success: {
    main: "#10B981",
    light: "#34D399",
    dark: "#059669",
  },
  error: {
    main: "#EF4444",
    light: "#F87171",
    dark: "#DC2626",
  },
  warning: {
    main: "#F59E0B",
    light: "#FBBF24",
    dark: "#D97706",
  },
  info: {
    main: "#3B82F6",
    light: "#60A5FA",
    dark: "#2563EB",
  },
};

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: colors.primary,
    secondary: colors.secondary,
    background: colors.background,
    text: colors.text,
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
    info: colors.info,
  },
  typography: {
    fontFamily: [
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      '"Helvetica Neue"',
      "Arial",
      "sans-serif",
    ].join(","),
    h1: {
      fontWeight: 700,
      fontSize: "2.5rem",
      lineHeight: 1.2,
      letterSpacing: "-0.01562em",
    },
    h2: {
      fontWeight: 700,
      fontSize: "2rem",
      lineHeight: 1.3,
      letterSpacing: "-0.00833em",
    },
    h3: {
      fontWeight: 600,
      fontSize: "1.75rem",
      lineHeight: 1.4,
    },
    h4: {
      fontWeight: 600,
      fontSize: "1.5rem",
      lineHeight: 1.4,
    },
    h5: {
      fontWeight: 600,
      fontSize: "1.25rem",
      lineHeight: 1.5,
    },
    h6: {
      fontWeight: 600,
      fontSize: "1.125rem",
      lineHeight: 1.6,
    },
    subtitle1: {
      fontSize: "1rem",
      lineHeight: 1.75,
      fontWeight: 500,
    },
    subtitle2: {
      fontSize: "0.875rem",
      lineHeight: 1.57,
      fontWeight: 500,
    },
    body1: {
      fontSize: "1rem",
      lineHeight: 1.5,
    },
    body2: {
      fontSize: "0.875rem",
      lineHeight: 1.43,
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  shadows: [
    "none",
    "0px 2px 4px rgba(0, 0, 0, 0.05)",
    "0px 4px 8px rgba(0, 0, 0, 0.08)",
    "0px 8px 16px rgba(0, 0, 0, 0.1)",
    "0px 12px 24px rgba(0, 0, 0, 0.12)",
    "0px 16px 32px rgba(0, 0, 0, 0.14)",
    "0px 20px 40px rgba(0, 0, 0, 0.16)",
    "0px 24px 48px rgba(0, 0, 0, 0.18)",
    "0px 2px 4px rgba(0, 0, 0, 0.05)",
    "0px 4px 8px rgba(0, 0, 0, 0.08)",
    "0px 8px 16px rgba(0, 0, 0, 0.1)",
    "0px 12px 24px rgba(0, 0, 0, 0.12)",
    "0px 16px 32px rgba(0, 0, 0, 0.14)",
    "0px 20px 40px rgba(0, 0, 0, 0.16)",
    "0px 24px 48px rgba(0, 0, 0, 0.18)",
    "0px 2px 4px rgba(0, 0, 0, 0.05)",
    "0px 4px 8px rgba(0, 0, 0, 0.08)",
    "0px 8px 16px rgba(0, 0, 0, 0.1)",
    "0px 12px 24px rgba(0, 0, 0, 0.12)",
    "0px 16px 32px rgba(0, 0, 0, 0.14)",
    "0px 20px 40px rgba(0, 0, 0, 0.16)",
    "0px 24px 48px rgba(0, 0, 0, 0.18)",
    "0px 2px 4px rgba(0, 0, 0, 0.05)",
    "0px 4px 8px rgba(0, 0, 0, 0.08)",
    "0px 8px 16px rgba(0, 0, 0, 0.1)",
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: "8px 20px",
          fontSize: "0.9375rem",
          fontWeight: 600,
          boxShadow: "none",
          "&:hover": {
            boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.15)",
          },
        },
        contained: {
          "&:hover": {
            boxShadow: "0px 6px 16px rgba(0, 0, 0, 0.2)",
          },
        },
        sizeLarge: {
          padding: "12px 28px",
          fontSize: "1rem",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
        elevation1: {
          boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.08)",
        },
        elevation2: {
          boxShadow: "0px 4px 16px rgba(0, 0, 0, 0.1)",
        },
        elevation3: {
          boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.12)",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.08)",
          transition: "transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.15)",
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.08)",
        },
        colorDefault: {
          backgroundColor: "#FFFFFF",
          color: colors.text.primary,
        },
        colorPrimary: {
          background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.primary.dark} 100%)`,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 8,
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: colors.primary.light,
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderWidth: 2,
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: "none",
          boxShadow: "4px 0px 16px rgba(0, 0, 0, 0.08)",
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          marginBottom: 4,
          "&:hover": {
            backgroundColor: "rgba(21, 101, 192, 0.08)",
          },
          "&.Mui-selected": {
            backgroundColor: "rgba(21, 101, 192, 0.12)",
            "&:hover": {
              backgroundColor: "rgba(21, 101, 192, 0.16)",
            },
          },
        },
      },
    },
  },
});

// Gradient backgrounds for special sections
export const gradients = {
  primary: `linear-gradient(135deg, ${colors.primary.dark} 0%, ${colors.primary.main} 100%)`,
  secondary: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.secondary.main} 100%)`,
  accent: `linear-gradient(135deg, ${colors.accent.main} 0%, ${colors.accent.dark} 100%)`,
  hero: `linear-gradient(135deg, ${colors.primary.dark} 0%, ${colors.primary.light} 100%)`,
  subtle: `linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)`,
  overlay: "linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.4) 100%)",
};

export default theme;
