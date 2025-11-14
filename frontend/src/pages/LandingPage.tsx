import { useState } from "react";
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  ThemeProvider,
} from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";
import theme from "../theme/theme";

export default function LandingPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(username.trim(), password);
      navigate("/");
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ??
          err?.message ??
          "Login failed. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  if (isAuthenticated) {
    navigate("/");
    return null;
  }

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          minHeight: "100vh",
          background:
            "linear-gradient(135deg,rgb(183, 211, 239) 0%, #E2E8F0 100%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          py: 4,
          position: "relative",
        }}
      >
        <Container maxWidth="sm" sx={{ position: "relative", zIndex: 1 }}>
          {/* Logo */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              mb: 4,
            }}
          >
            <img
              src="/VIMS4ALL_logo_large_no_background.jpeg"
              alt="VIMS4ALL"
              style={{
                maxWidth: "500px",
                width: "100%",
                height: "auto",
                objectFit: "contain",
                filter: "drop-shadow(0px 4px 12px rgba(0, 0, 0, 0.1))",
              }}
            />
          </Box>

          {/* Title */}
          <Typography
            variant="h3"
            align="center"
            sx={{
              mb: 0,
              fontWeight: 700,
              color: "#1565C0",
            }}
          >
            Vocational
          </Typography>
          <Typography
            variant="h4"
            align="center"
            sx={{
              mb: 2,
              fontWeight: 700,
              color: "#1565C0",
            }}
          >
            Institute Management System
          </Typography>

          <Typography
            variant="body1"
            align="center"
            sx={{
              mb: 4,
              color: "#64748B",
            }}
          >
            Sign in to access your account
          </Typography>

          {/* Login Card */}
          <Paper
            elevation={3}
            sx={{
              p: 4,
              borderRadius: 3,
              backgroundColor: "rgba(241, 241, 241, 0.57)",
              boxShadow: "0px 8px 32px rgba(52, 124, 207, 0.35)",
            }}
          >
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleLogin}>
              <TextField
                fullWidth
                label="Username"
                variant="outlined"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                sx={{ mb: 2.5 }}
              />
              <TextField
                fullWidth
                label="Password"
                type="password"
                variant="outlined"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                sx={{ mb: 3 }}
              />
              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                sx={{
                  py: 1.5,
                  fontSize: "1rem",
                  fontWeight: 600,
                  textTransform: "none",
                  background:
                    "linear-gradient(135deg, #0D47A1 0%, #42A5F5 100%)",
                  boxShadow: "0px 4px 12px rgba(21, 101, 192, 0.3)",
                  "&:hover": {
                    background:
                      "linear-gradient(135deg, #0D47A1 0%, #1565C0 100%)",
                    boxShadow: "0px 6px 16px rgba(21, 101, 192, 0.4)",
                  },
                }}
              >
                {loading ? "Signing In..." : "Sign In"}
              </Button>
            </Box>

            <Typography
              variant="body2"
              color="text.secondary"
              align="center"
              sx={{ mt: 3 }}
            >
              Need help? Contact your institution administrator
            </Typography>
          </Paper>

          {/* Footer */}
          <Typography
            variant="body2"
            align="center"
            sx={{ mt: 4, color: "#64748B" }}
          >
            © {new Date().getFullYear()} VIMS4ALL. All rights reserved.
          </Typography>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
