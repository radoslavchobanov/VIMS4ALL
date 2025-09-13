import { useState, PropsWithChildren } from "react";
import { useNavigate } from "react-router-dom";
import {
  ThemeProvider, createTheme, CssBaseline, AppBar, Toolbar, Typography,
  Box, IconButton, Drawer, List, ListItemButton, ListItemText,
  Button, TextField, Divider
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { useAuth } from "../auth/AuthContext";

const theme = createTheme({ palette: { mode: "light" } });

const MENU: Array<{ label: string; to: string; roles?: string[] }> = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Superuser", to: "/admin", roles: ["superuser"] },
  { label: "Students", to: "/students", roles: ["institute_admin"] },
  { label: "Employees", to: "/employees", roles: ["institute_admin"] },
  { label: "Courses", to: "/courses", roles: ["institute_admin"] },
];

export default function AppChrome({ children }: PropsWithChildren) {
  const nav = useNavigate();
  const { user, isAuthenticated, hasRole, login, logout } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const [u, setU] = useState(""); const [p, setP] = useState("");

  const items = MENU.filter(m => !m.roles || m.roles.some(r => hasRole(r)));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await login(u, p);
    setU(""); setP("");
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar sx={{ gap: 2 }}>
          <IconButton edge="start" onClick={() => setDrawer(true)}><MenuIcon /></IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>VIMS</Typography>

          {!isAuthenticated ? (
            <Box component="form" onSubmit={onSubmit} sx={{ display: "flex", gap: 1 }}>
              <TextField size="small" label="Username" value={u} onChange={e => setU(e.target.value)} />
              <TextField size="small" type="password" label="Password" value={p} onChange={e => setP(e.target.value)} />
              <Button type="submit" variant="contained">Login</Button>
            </Box>
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Typography variant="body2">Signed in as <b>{user?.username}</b></Typography>
              <Button variant="outlined" onClick={logout}>Logout</Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      <Drawer open={drawer} onClose={() => setDrawer(false)}>
        <Box sx={{ width: 260 }}>
          <Typography variant="h6" sx={{ p: 2 }}>Navigation</Typography>
          <Divider />
          <List>
            {items.map(i => (
              <ListItemButton key={i.to} onClick={() => { nav(i.to); setDrawer(false); }}>
                <ListItemText primary={i.label} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
        {children}
      </Box>
    </ThemeProvider>
  );
}
