import React, { useState, useEffect } from 'react';
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
} from '@mui/material';  // Semua sudah termasuk

const Login = ({ onLogin, open, onClose, onConnect }) => {
  const [mode, setMode] = useState('login'); // 'login' atau 'connection'
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    host: '',
    port: '22',
    sessionName: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Reset form ketika dialog dibuka
  React.useEffect(() => {
    if (open) {
      setMode('connection');
      setFormData({
        username: '',
        password: '',
        host: '',
        port: '22',
        sessionName: '',
      });
      setError('');
    }
  }, [open]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'login') {
        // Login ke aplikasi
        if (formData.username && formData.password) {
          onLogin(formData.username, formData.password);
          setSuccess('Login berhasil!');
        } else {
          setError('Username dan password harus diisi');
        }
      } else {
        // New SSH Connection
        if (!formData.host || !formData.username || !formData.password) {
          setError('Host, username, dan password harus diisi');
          setLoading(false);
          return;
        }

        // Validasi port
        const port = parseInt(formData.port);
        if (isNaN(port) || port < 1 || port > 65535) {
          setError('Port harus antara 1-65535');
          setLoading(false);
          return;
        }

        // Buat session name otomatis jika kosong
        const sessionName = formData.sessionName || 
          `${formData.username}@${formData.host}:${formData.port}`;

        // Panggil onConnect dari props
        await onConnect({
          id: Date.now().toString(),
          name: sessionName,
          host: formData.host,
          port: port,
          username: formData.username,
          password: formData.password,
          connected: false,
          status: 'disconnected'
        });

        setSuccess('Koneksi berhasil ditambahkan!');
        
        // Tutup dialog setelah 1 detik
        setTimeout(() => {
          onClose();
          setSuccess('');
        }, 1000);
      }
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setError('');
      setSuccess('');
    }
  };

  const switchToLogin = () => {
    setMode('login');
    setFormData({
      username: '',
      password: '',
      host: '',
      port: '22',
      sessionName: '',
    });
    setError('');
  };

  // Jika ini adalah dialog untuk new connection
  if (open !== undefined) {
    return (
      <>
        <Dialog 
          open={open} 
          onClose={handleClose}
          maxWidth="sm" 
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              p: 1
            }
          }}
        >
          <DialogTitle sx={{ 
            borderBottom: '1px solid',
            borderColor: 'divider',
            pb: 2
          }}>
            <Typography variant="h6" component="div">
              🔌 New SSH Connection
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Masukkan detail server untuk koneksi SSH
            </Typography>
          </DialogTitle>

          <form onSubmit={handleSubmit}>
            <DialogContent sx={{ pt: 3 }}>
              {/* Session Name */}
              <TextField
                autoFocus
                margin="dense"
                name="sessionName"
                label="Session Name (opsional)"
                type="text"
                fullWidth
                variant="outlined"
                value={formData.sessionName}
                onChange={handleChange}
                placeholder="Contoh: Production Server"
                sx={{ mb: 2 }}
              />

              {/* Host */}
              <TextField
                margin="dense"
                name="host"
                label="Host"
                type="text"
                fullWidth
                variant="outlined"
                value={formData.host}
                onChange={handleChange}
                required
                placeholder="Contoh: 192.168.1.100 atau example.com"
                sx={{ mb: 2 }}
              />

              {/* Port dan Username dalam 1 baris */}
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                  name="port"
                  label="Port"
                  type="number"
                  value={formData.port}
                  onChange={handleChange}
                  required
                  sx={{ width: '120px' }}
                  inputProps={{ min: 1, max: 65535 }}
                />
                <TextField
                  name="username"
                  label="Username"
                  type="text"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  fullWidth
                  placeholder="root, admin, atau user biasa"
                />
              </Box>

              {/* Password */}
              <TextField
                margin="dense"
                name="password"
                label="Password"
                type="password"
                fullWidth
                variant="outlined"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="********"
                sx={{ mb: 1 }}
              />

              {/* Error message */}
              {error && (
                <Alert severity="error" sx={{ mt: 2, mb: 1 }}>
                  {error}
                </Alert>
              )}

              {/* Info tambahan */}
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  ℹ️ Koneksi akan menggunakan SSH protocol. Pastikan server dapat diakses.
                </Typography>
              </Alert>
            </DialogContent>

            <DialogActions sx={{ p: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              <Button 
                onClick={handleClose} 
                disabled={loading}
                variant="outlined"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                variant="contained" 
                disabled={loading}
                startIcon={loading && <CircularProgress size={20} />}
                sx={{ minWidth: 100 }}
              >
                {loading ? 'Connecting...' : 'Connect'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Success notification */}
        <Snackbar
          open={!!success}
          autoHideDuration={3000}
          onClose={() => setSuccess('')}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity="success" variant="filled">
            {success}
          </Alert>
        </Snackbar>
      </>
    );
  }

  // Main login screen (untuk pertama kali buka app)
  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(45deg, #1a1a1a 30%, #2d2d2d 90%)',
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 400,
          p: 4,
          borderRadius: 2,
          bgcolor: 'background.paper',
          boxShadow: 24,
        }}
      >
        <Typography variant="h5" component="h1" gutterBottom align="center">
          🚀 XShell Clone
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
          SSH Terminal Client di Browser
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
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
            {loading ? <CircularProgress size={24} /> : 'Sign In'}
          </Button>
        </form>

        <Typography variant="body2" align="center" color="text.secondary">
          Gunakan username dan password apapun untuk testing
        </Typography>
      </Box>
    </Box>
  );
};

export default Login;