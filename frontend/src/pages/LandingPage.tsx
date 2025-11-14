import { useState } from "react";
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
} from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";

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
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        {/* Logo */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            mb: 4,
          }}
        >
          <img
            src="/VIMS4ALL_logo.jpeg"
            alt="VIMS4ALL"
            style={{
              maxWidth: "420px",
              width: "100%",
              height: "auto",
              objectFit: "contain",
            }}
          />
        </Box>

        {/* Title */}
        <Typography
          variant="h4"
          align="center"
          sx={{
            mb: 1,
            fontWeight: 600,
            color: "#2c3e50",
          }}
        >
          Institute Management System
        </Typography>

        <Typography
          variant="body1"
          align="center"
          color="text.secondary"
          sx={{ mb: 4 }}
        >
          Sign in to access your account
        </Typography>

        {/* Login Card */}
        <Paper
          elevation={2}
          sx={{
            p: 4,
            borderRadius: 2,
            backgroundColor: "white",
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
                fontWeight: 500,
                textTransform: "none",
                backgroundColor: "#1976d2",
                "&:hover": {
                  backgroundColor: "#1565c0",
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
          color="text.secondary"
          align="center"
          sx={{ mt: 4 }}
        >
          © {new Date().getFullYear()} VIMS4ALL. All rights reserved.
        </Typography>
      </Container>
    </Box>
  );
}
