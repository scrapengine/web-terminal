import React, { useState, useEffect } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Box from "@mui/material/Box";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import TerminalIcon from "@mui/icons-material/Terminal";
import Login from "./components/Login";
import Terminal from "./components/Terminal";
import TabBar from "./components/TabBar";
import QuickCommand from "./components/QuickCommand";
import axios from "axios";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#22c55e",
    },
    background: {
      default: "#0f172a",
      paper: "#111827",
    },
    divider: "#1f2937",
  },
  typography: {
    fontFamily: `'JetBrains Mono', 'Inter', monospace`,
    fontSize: 13,
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: "linear-gradient(90deg, #0f172a, #111827)",
          borderBottom: "1px solid #1f2937",
        },
      },
    },
  },
});

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [savedHosts, setSavedHosts] = useState([]);
  const [userId, setUserId] = useState(localStorage.getItem("user_id"));

  useEffect(() => {
    const auth = localStorage.getItem("xshell-auth");
    if (auth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  // Load saved hosts setelah login
  useEffect(() => {
    if (isAuthenticated && userId) {
      axios
        .get(`http://localhost:8000/api/hosts/${userId}`)
        .then((res) => {
          setSavedHosts(res.data);
        })
        .catch((err) => {
          console.error("Failed to load saved hosts:", err);
        });
    }
  }, [isAuthenticated, userId]);

  const handleLogin = (username, password) => {
    // Login akan di-handle oleh Login component
    // Setelah login sukses, Login component akan panggil onLogin dengan user_id
    localStorage.setItem("xshell-auth", "true");
    localStorage.setItem("username", username);
    setIsAuthenticated(true);
  };

  // Callback dari Login component setelah login sukses
  const handleLoginSuccess = (userId) => {
    setUserId(userId);
    localStorage.setItem("user_id", userId);
  };

  const handleLogout = () => {
    localStorage.removeItem("xshell-auth");
    localStorage.removeItem("username");
    localStorage.removeItem("user_id");
    setIsAuthenticated(false);
    setSessions([]);
    setActiveSession(null);
    setSavedHosts([]);
  };

  const handleNewSession = (connection) => {
    // const existingSession = sessions.find(
    //   (s) =>
    //     s.host === connection.host &&
    //     s.port === connection.port &&
    //     s.username === connection.username,
    // );

    // if (existingSession) {
    //   alert(
    //     `Session ke ${connection.host} sudah ada! Beralih ke tab tersebut.`,
    //   );
    //   setActiveSession(existingSession.id);
    //   setShowLogin(false);
    //   return;
    // }

    const sessionName =
      connection.sessionName ||
      `${connection.username}@${connection.host}:${connection.port}`;

    const newSession = {
      id: Date.now().toString(),
      name: sessionName,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      password: connection.password,
      connected: false,
      status: "disconnected",
    };

    setSessions([...sessions, newSession]);
    setActiveSession(newSession.id);
    setShowLogin(false);
  };

  // Connect ke saved host
  const handleConnectSavedHost = (sessionData) => {
    // console.log("🟢 App.js: Received session:", sessionData);

    // LANGSUNG tambah session, JANGAN panggil API lagi
    setSessions((prev) => [...prev, sessionData]);
    setActiveSession(sessionData.id);
    setShowLogin(false);
  };

  const handleConnect = async (sessionId, isReconnect = false) => {
    const session = sessions.find((s) => s.id === sessionId);

    // 🔥 UNTUK LOCAL TERMINAL - SELALU CONNECT ULANG (baik reconnect maupun connect biasa)
    if (session.isLocal) {
      console.log("Connecting/Reconnecting local terminal...");
      try {
        const response = await axios.post(
          "http://localhost:8000/api/connect-local",
        );

        if (response.data.status === "connected") {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    backendId: response.data.session_id,
                    connected: true,
                    status: "connected",
                  }
                : s,
            ),
          );
          console.log("✅ Local terminal connected");
        }
      } catch (error) {
        console.error("Failed to connect local terminal:", error);
        alert("Failed to connect local terminal");
      }
      return;
    }

    // 🔥 UNTUK SSH (kode existing)
    if (!isReconnect) {
      if (!session.password) {
        console.error("Password is missing for session:", session);
        alert("Password tidak ditemukan. Silakan tambahkan host lagi.");
        return;
      }
    }

    try {
      const connectionData = {
        host: session.host,
        port: parseInt(session.port, 10),
        username: session.username,
        password: session.password,
      };

      const response = await axios.post(
        "http://localhost:8000/api/connect",
        connectionData,
        { headers: { "Content-Type": "application/json" } },
      );

      if (response.data.status === "connected") {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  connected: true,
                  status: "connected",
                  backendId: response.data.session_id,
                }
              : s,
          ),
        );
      }
    } catch (error) {
      console.error("Connection failed:", error);
      alert(
        "Failed to connect: " + (error.response?.data?.detail || error.message),
      );
    }
  };

  const handleDisconnect = async (sessionId) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session.backendId) {
      try {
        await axios.post(
          `http://localhost:8000/api/disconnect/${session.backendId}`,
        );
      } catch (error) {
        console.error("Disconnect error:", error);
      }
    }

    setSessions(
      sessions.map((s) =>
        s.id === sessionId
          ? { ...s, connected: false, status: "disconnected" }
          : s,
      ),
    );
  };

  const handleReconnect = async (sessionId) => {
    await handleDisconnect(sessionId);
    setTimeout(() => handleConnect(sessionId, true), 1000); // ← true = isReconnect
  };

  const handleCloseTab = (sessionId) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session.connected) {
      handleDisconnect(sessionId);
    }

    const newSessions = sessions.filter((s) => s.id !== sessionId);
    setSessions(newSessions);

    if (activeSession === sessionId) {
      setActiveSession(newSessions.length > 0 ? newSessions[0].id : null);
    }
  };

  const handleQuickCommand = (command) => {};

  if (!isAuthenticated) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Login onLogin={handleLogin} onLoginSuccess={handleLoginSuccess} />
      </ThemeProvider>
    );
  }

  const handleConnectLocal = async () => {
    try {
      const response = await axios.post(
        "http://localhost:8000/api/connect-local",
      );

      if (response.data.status === "connected") {
        // 🔥 Ambil informasi platform dari response jika ada
        const platform = response.data.platform || "local";
        const shell = response.data.shell || "";

        const newSession = {
          id: Date.now().toString(),
          name: `Local Terminal${shell ? ` (${shell})` : ""}`, // Nama lebih deskriptif
          host: "localhost",
          port: 0,
          username: "local",
          password: "",
          backendId: response.data.session_id,
          connected: true,
          status: "connected",
          isLocal: true,
          platform: platform, // Simpan info platform
        };

        setSessions((prev) => [...prev, newSession]);
        setActiveSession(newSession.id);

        console.log(`✅ Local terminal connected: ${platform} ${shell}`);
      }
    } catch (error) {
      console.error("Failed to connect local terminal:", error);
      alert(
        "Failed to connect local terminal: " +
          (error.response?.data?.detail || error.message),
      );
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <AppBar position="static" elevation={0}>
          <Toolbar variant="dense" sx={{ minHeight: 48 }}>
            <TerminalIcon sx={{ mr: 1, color: "primary.main" }} />
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 500,
                letterSpacing: 0.5,
                flexGrow: 1,
              }}
            >
              XShell Clone
            </Typography>

            <Button
              color="primary"
              variant="outlined"
              size="small"
              sx={{ mr: 1 }}
              onClick={() => setShowLogin(true)}
            >
              New Connection
            </Button>

            <Button
              color="secondary"
              variant="outlined"
              size="small"
              sx={{ mr: 1 }}
              onClick={handleConnectLocal}
            >
              Local Terminal
            </Button>

            <Button
              color="inherit"
              size="small"
              onClick={handleLogout}
              sx={{ opacity: 0.7, "&:hover": { opacity: 1 } }}
            >
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
          savedHosts={savedHosts}
          onConnectSaved={handleConnectSavedHost}
        />

        <Box
          sx={{
            flex: 1,
            overflow: "hidden",
            position: "relative",
            bgcolor: "#0b1220",
          }}
        >
          {sessions.map((session) => (
            <Box
              key={session.id}
              sx={{
                display: activeSession === session.id ? "block" : "none",
                height: "100%",
              }}
            >
              <Terminal session={session} onQuickCommand={handleQuickCommand} />
            </Box>
          ))}

          {sessions.length === 0 && (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
                color: "text.secondary",
                gap: 2,
              }}
            >
              <TerminalIcon sx={{ fontSize: 60, opacity: 0.2 }} />
              <Typography variant="h6" sx={{ opacity: 0.7 }}>
                No active sessions
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.5 }}>
                Click "New Connection" to start
              </Typography>
            </Box>
          )}
        </Box>

        <QuickCommand onCommand={handleQuickCommand} userId={userId} />

        {showLogin && (
          <Login
            open={showLogin}
            onClose={() => setShowLogin(false)}
            onConnect={handleNewSession} // untuk new connection
            onConnectSaved={handleConnectSavedHost} // untuk saved host
            userId={userId}
            savedHosts={savedHosts}
          />
        )}
      </Box>
    </ThemeProvider>
  );
}

export default App;
