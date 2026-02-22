import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  Snackbar,
  CircularProgress,
  Tabs,
  Tab,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  IconButton,
  Tooltip,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import axios from "axios";
import EditIcon from "@mui/icons-material/Edit";

const API_URL = "http://localhost:8000/api";

const Login = ({ onLogin, open, onClose, onConnect, onConnectSaved }) => {
  const [mode, setMode] = useState("login"); // 'login', 'register', 'saved', 'connection'
  const [openDialog, setOpenDialog] = useState(false); // untuk register dari main screen
  const [editingHost, setEditingHost] = useState(null);
  const [editHostDialog, setEditHostDialog] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    registerUsername: "",
    registerPassword: "",
    host: "",
    port: "22",
    sessionName: "",
    hostUsername: "",
    hostPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savedHosts, setSavedHosts] = useState([]);
  const [userId, setUserId] = useState(localStorage.getItem("user_id"));

  // Load saved hosts jika user sudah login
  useEffect(() => {
    if (userId && (mode === "saved" || open)) {
      loadSavedHosts();
    }
  }, [userId, mode]);

  const loadSavedHosts = async () => {
    try {
      const response = await axios.get(`${API_URL}/hosts/${userId}`);
      setSavedHosts(response.data);
    } catch (err) {
      console.error("Failed to load hosts:", err);
    }
  };

  // Reset form ketika dialog dibuka
  useEffect(() => {
    if (open || openDialog) {
      setMode("saved"); // Default ke saved hosts jika sudah login
      setFormData({
        username: "",
        password: "",
        registerUsername: "",
        registerPassword: "",
        host: "",
        port: "22",
        sessionName: "",
        hostUsername: "",
        hostPassword: "",
      });
      setError("");
    }
  }, [open, openDialog]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Login dengan query parameters (bukan JSON)
      const response = await axios.post(
        `${API_URL}/login`,
        null, // tidak ada body
        {
          params: {
            username: formData.username,
            password: formData.password,
          },
        },
      );

      localStorage.setItem("user_id", response.data.user_id);
      setUserId(response.data.user_id);

      onLogin(formData.username, formData.password);
      setSuccess("Login berhasil!");
      setMode("saved");
    } catch (err) {
      console.error("Login error:", err.response?.data || err.message);
      setError(err.response?.data?.detail || err.message || "Login gagal");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Validasi input
      if (!formData.registerUsername || !formData.registerPassword) {
        setError("Username dan password harus diisi");
        setLoading(false);
        return;
      }

      // Kirim sebagai query parameters (bukan JSON)
      const response = await axios.post(
        `${API_URL}/register`,
        null, // tidak ada body
        {
          params: {
            username: formData.registerUsername,
            password: formData.registerPassword,
          },
        },
      );

      setSuccess("Registrasi berhasil! Silakan login.");
      setTimeout(() => {
        setMode("login");
        setOpenDialog(false);
        setSuccess("");
      }, 2000);
    } catch (err) {
      console.error("Register error:", err.response?.data || err.message);

      // Tampilkan error dari backend
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          const messages = err.response.data.detail
            .map((d) => d.msg)
            .join(", ");
          setError(messages);
        } else {
          setError(err.response.data.detail);
        }
      } else {
        setError(err.message || "Registrasi gagal");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddHost = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Validasi userId
      if (!userId) {
        setError("Anda harus login terlebih dahulu");
        setLoading(false);
        return;
      }

      // Kirim sebagai query parameters
      const response = await axios.post(
        `${API_URL}/hosts`,
        null, // tidak ada body
        {
          params: {
            user_id: userId,
            host: formData.host,
            port: formData.port,
            username: formData.hostUsername,
            password: formData.hostPassword,
          },
        },
      );

      setSuccess("Host berhasil disimpan!");
      loadSavedHosts();

      // Reset form
      setFormData({
        ...formData,
        host: "",
        port: "22",
        hostUsername: "",
        hostPassword: "",
        sessionName: "",
      });
    } catch (err) {
      console.error("Add host error:", err.response?.data || err.message);

      // Tampilkan error dari backend
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          const messages = err.response.data.detail
            .map((d) => d.msg)
            .join(", ");
          setError(messages);
        } else {
          setError(err.response.data.detail);
        }
      } else {
        setError(err.message || "Gagal menyimpan host");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnectSaved = async (host) => {
    setLoading(true);
    try {
      // 1. Panggil API connect-saved
      const response = await axios.post(`${API_URL}/connect-saved/${host.id}`);

      // 2. Buat session data
      const sessionData = {
        id: Date.now().toString(),
        name: `${host.username}@${host.host}:${host.port}`,
        host: host.host,
        port: host.port,
        username: host.username,
        password: host.password,
        backendId: response.data.session_id,
        connected: true,
        status: "connected",
      };

      // 3. Kirim ke App.js (HANYA SEKALI)
      onConnectSaved(sessionData);

      // 4. Tutup dialog
      onClose();
    } catch (err) {
      console.error("❌ Error:", err);
      setError("Gagal connect: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setOpenDialog(false);
      setError("");
      setSuccess("");
    }
  };

  const handleEditHost = (host) => {
    setEditingHost(host);
    setFormData({
      host: host.host,
      port: host.port.toString(),
      hostUsername: host.username,
      hostPassword: host.password,
      sessionName: `${host.username}@${host.host}:${host.port}`,
    });
    setEditHostDialog(true);
  };

  const handleUpdateHost = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // PUT request ke endpoint update host (kita perlu buat endpoint ini)
      await axios.put(`${API_URL}/hosts/${editingHost.id}`, null, {
        params: {
          user_id: userId,
          host: formData.host,
          port: parseInt(formData.port),
          username: formData.hostUsername,
          password: formData.hostPassword,
        },
      });

      setSuccess("Host updated successfully");
      loadSavedHosts();
      setEditHostDialog(false);
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update host");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHost = async (hostId) => {
    if (!confirm("Are you sure you want to delete this host?")) return;

    setLoading(true);
    try {
      await axios.delete(`${API_URL}/hosts/${hostId}`, {
        params: { user_id: userId },
      });

      setSuccess("Host deleted successfully");
      loadSavedHosts();
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete host");
    } finally {
      setLoading(false);
    }
  };

  // ====================================================
  // ✅ MAIN LOGIN SCREEN (UNTUK PERTAMA KALI BUKA APP)
  // ====================================================
  if (open === undefined) {
    return (
      <>
        <Box
          sx={{
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(45deg, #1a1a1a 30%, #2d2d2d 90%)",
          }}
        >
          <Box
            sx={{
              width: "100%",
              maxWidth: 400,
              p: 4,
              borderRadius: 2,
              bgcolor: "background.paper",
              boxShadow: 24,
            }}
          >
            <Typography variant="h5" component="h1" gutterBottom align="center">
              🚀 XShell Clone
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              align="center"
              sx={{ mb: 3 }}
            >
              SSH Terminal Client di Browser
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {typeof error === "string" ? error : "Terjadi kesalahan"}
              </Alert>
            )}

            <form onSubmit={handleLogin}>
              <TextField
                fullWidth
                margin="normal"
                name="username"
                label="Username"
                variant="outlined"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={loading}
              />
              <TextField
                fullWidth
                margin="normal"
                name="password"
                label="Password"
                type="password"
                variant="outlined"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{ mt: 3, mb: 2 }}
              >
                {loading ? <CircularProgress size={24} /> : "Sign In"}
              </Button>
            </form>

            <Box sx={{ textAlign: "center", mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Belum punya akun?
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setMode("register");
                  setOpenDialog(true);
                }}
                sx={{ textTransform: "none" }}
              >
                Daftar Sekarang
              </Button>
            </Box>
          </Box>
        </Box>

        {/* ✅ TAMBAHKAN DIALOG DI SINI */}
        <Dialog
          open={openDialog}
          onClose={() => setOpenDialog(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{ sx: { borderRadius: 2, minHeight: 500 } }}
        >
          <DialogTitle sx={{ borderBottom: 1, borderColor: "divider", pb: 2 }}>
            <Typography variant="h6">SSH Connection Manager</Typography>
          </DialogTitle>

          <Tabs
            value={mode}
            onChange={(e, v) => setMode(v)}
            sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}
          >
            <Tab label="Login" value="login" />
            <Tab label="Register" value="register" />
            <Tab label="Saved Hosts" value="saved" disabled={!userId} />
            <Tab label="New Connection" value="connection" />
          </Tabs>

          <DialogContent sx={{ pt: 3 }}>
            {/* REGISTER TAB (KARENA KITA SET mode="register") */}
            {mode === "register" && (
              <Box component="form" onSubmit={handleRegister}>
                <TextField
                  fullWidth
                  margin="normal"
                  name="registerUsername"
                  label="Username"
                  value={formData.registerUsername}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
                <TextField
                  fullWidth
                  margin="normal"
                  name="registerPassword"
                  label="Password"
                  type="password"
                  value={formData.registerPassword}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={loading}
                  sx={{ mt: 3 }}
                >
                  {loading ? <CircularProgress size={24} /> : "Register"}
                </Button>
              </Box>
            )}
          </DialogContent>

          <DialogActions sx={{ p: 3, borderTop: 1, borderColor: "divider" }}>
            <Button onClick={() => setOpenDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={!!success}
          autoHideDuration={3000}
          onClose={() => setSuccess("")}
        >
          <Alert severity="success">{success}</Alert>
        </Snackbar>
      </>
    );
  }

  // ====================================================
  // ✅ DIALOG UNTUK NEW CONNECTION (EXISTING CODE)
  // ====================================================
  return (
    <>
      <Dialog
        open={open || openDialog}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, minHeight: 500 } }}
      >
        <DialogTitle sx={{ borderBottom: 1, borderColor: "divider", pb: 2 }}>
          <Typography variant="h6">SSH Connection Manager</Typography>
        </DialogTitle>

        <Tabs
          value={mode}
          onChange={(e, v) => setMode(v)}
          sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}
        >
          <Tab label="Login" value="login" />
          <Tab label="Register" value="register" />
          <Tab label="Saved Hosts" value="saved" disabled={!userId} />
          <Tab label="New Connection" value="connection" />
        </Tabs>

        <DialogContent sx={{ pt: 3 }}>
          {/* LOGIN TAB */}
          {mode === "login" && (
            <Box component="form" onSubmit={handleLogin}>
              <TextField
                fullWidth
                margin="normal"
                name="username"
                label="Username"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={loading}
              />
              <TextField
                fullWidth
                margin="normal"
                name="password"
                label="Password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                sx={{ mt: 3 }}
              >
                {loading ? <CircularProgress size={24} /> : "Login"}
              </Button>
            </Box>
          )}

          {/* REGISTER TAB */}
          {mode === "register" && (
            <Box component="form" onSubmit={handleRegister}>
              <TextField
                fullWidth
                margin="normal"
                name="registerUsername"
                label="Username"
                value={formData.registerUsername}
                onChange={handleChange}
                required
                disabled={loading}
              />
              <TextField
                fullWidth
                margin="normal"
                name="registerPassword"
                label="Password"
                type="password"
                value={formData.registerPassword}
                onChange={handleChange}
                required
                disabled={loading}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                sx={{ mt: 3 }}
              >
                {loading ? <CircularProgress size={24} /> : "Register"}
              </Button>
            </Box>
          )}

          {/* SAVED HOSTS TAB */}
          {/* SAVED HOSTS TAB */}
          {mode === "saved" && (
            <Box>
              {savedHosts.length === 0 ? (
                <Alert severity="info">
                  Belum ada saved hosts. Tambahkan di tab "New Connection".
                </Alert>
              ) : (
                <List>
                  {savedHosts.map((host) => (
                    <Paper key={host.id} sx={{ mb: 1 }}>
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <ListItemButton
                          onClick={() => handleConnectSaved(host)}
                          sx={{ flex: 1 }}
                        >
                          <ListItemText
                            primary={host.host}
                            secondary={`${host.username} : ${host.port}`}
                          />
                        </ListItemButton>

                        <Box sx={{ display: "flex", gap: 0.5, mr: 1 }}>
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={() => handleEditHost(host)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteHost(host.id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    </Paper>
                  ))}
                </List>
              )}
            </Box>
          )}

          {/* NEW CONNECTION TAB */}
          {mode === "connection" && (
            <Box component="form" onSubmit={handleAddHost}>
              <TextField
                fullWidth
                margin="dense"
                name="sessionName"
                label="Session Name (opsional)"
                value={formData.sessionName}
                onChange={handleChange}
                placeholder="Contoh: Production Server"
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                margin="dense"
                name="host"
                label="Host"
                value={formData.host}
                onChange={handleChange}
                required
                placeholder="192.168.1.100 atau example.com"
                sx={{ mb: 2 }}
              />

              <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                <TextField
                  name="port"
                  label="Port"
                  type="number"
                  value={formData.port}
                  onChange={handleChange}
                  required
                  sx={{ width: "120px" }}
                  inputProps={{ min: 1, max: 65535 }}
                />
                <TextField
                  name="hostUsername"
                  label="Username"
                  value={formData.hostUsername}
                  onChange={handleChange}
                  required
                  fullWidth
                />
              </Box>

              <TextField
                fullWidth
                margin="dense"
                name="hostPassword"
                label="Password"
                type="password"
                value={formData.hostPassword}
                onChange={handleChange}
                required
                sx={{ mb: 2 }}
              />

              {userId ? (
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={loading}
                >
                  {loading ? <CircularProgress size={24} /> : "Save Host"}
                </Button>
              ) : (
                <Alert severity="warning">
                  Login dulu untuk menyimpan host
                </Alert>
              )}
            </Box>
          )}

          {/* Error/Success Messages */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {typeof error === "string" ? error : "Terjadi kesalahan"}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, borderTop: 1, borderColor: "divider" }}>
          <Button onClick={handleClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ✅ EDIT HOST DIALOG */}
      <Dialog
        open={editHostDialog}
        onClose={() => setEditHostDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Host</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleUpdateHost}>
            <TextField
              fullWidth
              margin="dense"
              name="host"
              label="Host"
              value={formData.host}
              onChange={handleChange}
              required
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
              <TextField
                name="port"
                label="Port"
                type="number"
                value={formData.port}
                onChange={handleChange}
                required
                sx={{ width: "120px" }}
                inputProps={{ min: 1, max: 65535 }}
              />
              <TextField
                name="hostUsername"
                label="Username"
                value={formData.hostUsername}
                onChange={handleChange}
                required
                fullWidth
              />
            </Box>

            <TextField
              fullWidth
              margin="dense"
              name="hostPassword"
              label="Password"
              type="password"
              value={formData.hostPassword}
              onChange={handleChange}
              required
              sx={{ mb: 2 }}
            />

            {error && (
              <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
                {error}
              </Alert>
            )}

            <DialogActions sx={{ px: 0, pb: 0 }}>
              <Button onClick={() => setEditHostDialog(false)}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={!!success}
        autoHideDuration={3000}
        onClose={() => setSuccess("")}
      >
        <Alert severity="success">{success}</Alert>
      </Snackbar>
    </>
  );
};

export default Login;
