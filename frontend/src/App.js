import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import TerminalIcon from '@mui/icons-material/Terminal';
import Login from './components/Login';
import Terminal from './components/Terminal';
import TabBar from './components/TabBar';
import QuickCommand from './components/QuickCommand';
import axios from 'axios';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    background: {
      default: '#1e1e1e',
      paper: '#2d2d2d',
    },
  },
});

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    // Check if user is authenticated (simple localStorage check)
    const auth = localStorage.getItem('xshell-auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (username, password) => {
    // Simple authentication (in production, use proper auth)
    if (username && password) {
      localStorage.setItem('xshell-auth', 'true');
      localStorage.setItem('username', username);
      setIsAuthenticated(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('xshell-auth');
    localStorage.removeItem('username');
    setIsAuthenticated(false);
    setSessions([]);
    setActiveSession(null);
  };

  const handleNewSession = (connection) => {
    const newSession = {
      id: Date.now().toString(),
      ...connection,
      connected: false,
      status: 'disconnected'
    };
    setSessions([...sessions, newSession]);
    setActiveSession(newSession.id);
  };

  const handleConnect = async (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    try {
      const response = await axios.post('http://localhost:8000/api/connect', {
        host: session.host,
        port: session.port,
        username: session.username,
        password: session.password
      });
      
      if (response.data.status === 'connected') {
        setSessions(sessions.map(s => 
          s.id === sessionId 
            ? { ...s, connected: true, status: 'connected', backendId: response.data.session_id }
            : s
        ));
      }
    } catch (error) {
      console.error('Connection failed:', error);
      alert('Failed to connect to server');
    }
  };

  const handleDisconnect = async (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session.backendId) {
      try {
        await axios.post(`http://localhost:8000/api/disconnect/${session.backendId}`);
      } catch (error) {
        console.error('Disconnect error:', error);
      }
    }
    
    setSessions(sessions.map(s => 
      s.id === sessionId 
        ? { ...s, connected: false, status: 'disconnected' }
        : s
    ));
  };

  const handleReconnect = async (sessionId) => {
    await handleDisconnect(sessionId);
    setTimeout(() => handleConnect(sessionId), 1000);
  };

  const handleCloseTab = (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session.connected) {
      handleDisconnect(sessionId);
    }
    
    const newSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(newSessions);
    
    if (activeSession === sessionId) {
      setActiveSession(newSessions.length > 0 ? newSessions[0].id : null);
    }
  };

  const handleQuickCommand = (command) => {
    // This will be passed to Terminal component
    // Implementation in Terminal component
  };

  if (!isAuthenticated) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Login onLogin={handleLogin} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <AppBar position="static">
          <Toolbar variant="dense">
            <TerminalIcon sx={{ mr: 1 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              XShell Clone
            </Typography>
            <Button color="inherit" onClick={() => setShowLogin(true)}>
              New Connection
            </Button>
            <Button color="inherit" onClick={handleLogout}>
              Logout
            </Button>
          </Toolbar>
        </AppBar>

        <TabBar
          sessions={sessions}
          activeSession={activeSession}
          onSelectSession={setActiveSession}
          onCloseTab={handleCloseTab}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onReconnect={handleReconnect}
        />

        <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {sessions.map(session => (
            <Box
              key={session.id}
              sx={{
                display: activeSession === session.id ? 'block' : 'none',
                height: '100%',
              }}
            >
              <Terminal
                session={session}
                onQuickCommand={handleQuickCommand}
              />
            </Box>
          ))}
          
          {sessions.length === 0 && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                color: 'text.secondary',
              }}
            >
              <Typography variant="h6">
                No active sessions. Click "New Connection" to start.
              </Typography>
            </Box>
          )}
        </Box>

        <QuickCommand onCommand={handleQuickCommand} />

        {showLogin && (
          <Login
            open={showLogin}
            onClose={() => setShowLogin(false)}
            onConnect={handleNewSession}
          />
        )}
      </Box>
    </ThemeProvider>
  );
}

export default App;