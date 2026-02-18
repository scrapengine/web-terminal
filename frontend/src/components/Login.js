import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
} from '@mui/material';

const Login = ({ onLogin, open, onClose, onConnect }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    host: '',
    port: '22',
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (isLoginMode) {
      // App login
      onLogin(formData.username, formData.password);
    } else {
      // New SSH connection
      onConnect({
        host: formData.host,
        port: parseInt(formData.port),
        username: formData.username,
        password: formData.password,
      });
      onClose();
      // Reset form
      setFormData({
        username: '',
        password: '',
        host: '',
        port: '22',
      });
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setFormData({
      username: '',
      password: '',
      host: '',
      port: '22',
    });
  };

  // If used as dialog for new connection
  if (!isLoginMode && open !== undefined) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>New SSH Connection</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              name="host"
              label="Host"
              type="text"
              fullWidth
              variant="outlined"
              value={formData.host}
              onChange={handleChange}
              required
            />
            <TextField
              margin="dense"
              name="port"
              label="Port"
              type="number"
              fullWidth
              variant="outlined"
              value={formData.port}
              onChange={handleChange}
              required
            />
            <TextField
              margin="dense"
              name="username"
              label="Username"
              type="text"
              fullWidth
              variant="outlined"
              value={formData.username}
              onChange={handleChange}
              required
            />
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
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="contained">Connect</Button>
          </DialogActions>
        </form>
      </Dialog>
    );
  }

  // Main login screen
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
          XShell Clone
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
          Please sign in to continue
        </Typography>
        
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
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            sx={{ mt: 3, mb: 2 }}
          >
            Sign In
          </Button>
        </form>
      </Box>
    </Box>
  );
};

export default Login;