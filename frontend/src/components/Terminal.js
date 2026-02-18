import React, { useEffect, useRef, useState } from "react";
import { Box, IconButton, Tooltip, Chip, Typography } from "@mui/material"; // Tambahkan Typography di sini
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";
import RefreshIcon from "@mui/icons-material/Refresh";
import LinkOffIcon from "@mui/icons-material/LinkOff";

const Terminal = ({ session, onQuickCommand }) => {
  const terminalRef = useRef(null);
  const terminalInstance = useRef(null);
  const fitAddon = useRef(null);
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("disconnected");

  useEffect(() => {
    if (!session.connected || !session.backendId) {
      return;
    }

    // Initialize terminal dengan konfigurasi lebih baik
    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: "#1e1e1e",
        foreground: "#f0f0f0",
        cursor: "#f0f0f0",
        selection: "rgba(255,255,255,0.3)",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
      },
      rows: 30,
      cols: 80,
      scrollback: 1000,
      tabStopWidth: 4,
    });

    // Add addons
    fitAddon.current = new FitAddon();
    term.loadAddon(fitAddon.current);
    term.loadAddon(new WebLinksAddon());

    // Open terminal
    term.open(terminalRef.current);
    fitAddon.current.fit();

    // Focus terminal
    setTimeout(() => {
      term.focus();
    }, 100);

    // WebSocket connection
    setStatus("connecting");
    const ws = new WebSocket(
      `ws://localhost:8000/ws/terminal/${session.backendId}`,
    );
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      setConnected(true);
      setStatus("connected");

      // Kirim ukuran terminal setelah connect
      setTimeout(() => {
        if (fitAddon.current && ws.readyState === WebSocket.OPEN) {
          const dimensions = fitAddon.current.proposeDimensions();
          ws.send(
            JSON.stringify({
              type: "resize",
              cols: dimensions.cols,
              rows: dimensions.rows,
            }),
          );
        }
      }, 500);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "data") {
          term.write(data.data);
        } else if (data.type === "error") {
          term.writeln("\x1b[31m" + data.data + "\x1b[0m\r\n");
        }
      } catch (e) {
        console.error("Error parsing message:", e);
      }
    };

    ws.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
      setConnected(false);
      setStatus("disconnected");
      term.writeln("\x1b[31m\r\nDisconnected from server\x1b[0m\r\n");
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setStatus("error");
      term.writeln("\x1b[31m\r\nConnection error\x1b[0m\r\n");
    };

    // Handle terminal input - kirim ke WebSocket
    term.onData((data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "input",
            data: data,
          }),
        );
      }
    });

    // Handle resize
    const handleResize = () => {
      if (
        fitAddon.current &&
        wsRef.current &&
        wsRef.current.readyState === WebSocket.OPEN
      ) {
        const dimensions = fitAddon.current.proposeDimensions();
        wsRef.current.send(
          JSON.stringify({
            type: "resize",
            cols: dimensions.cols,
            rows: dimensions.rows,
          }),
        );
      }
    };
    window.addEventListener("resize", handleResize);

    terminalInstance.current = term;

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      if (terminalInstance.current) {
        terminalInstance.current.dispose();
      }
    };
  }, [session.connected, session.backendId]);

  // Handle quick commands from parent
  useEffect(() => {
    if (onQuickCommand) {
      window.sendCommandToTerminal = (command) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "command",
              data: command,
            }),
          );
          terminalInstance.current.write(command + "\r\n");
        }
      };
    }
  }, [onQuickCommand]);

  const handleReconnect = () => {
    if (window.handleReconnect) {
      window.handleReconnect(session.id);
    }
  };

  const handleDisconnect = () => {
    if (window.handleDisconnect) {
      window.handleDisconnect(session.id);
    }
  };

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          p: 1,
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip
            size="small"
            label={status}
            color={
              status === "connected"
                ? "success"
                : status === "connecting"
                  ? "warning"
                  : "error"
            }
            variant="outlined"
          />
          <Typography variant="body2" color="text.secondary">
            {session.host}:{session.port} as {session.username}
          </Typography>
        </Box>

        <Box>
          <Tooltip title="Reconnect">
            <span>
              <IconButton
                size="small"
                onClick={handleReconnect}
                disabled={connected}
              >
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Disconnect">
            <span>
              <IconButton
                size="small"
                onClick={handleDisconnect}
                disabled={!connected}
              >
                <LinkOffIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <Box
        ref={terminalRef}
        sx={{
          flex: 1,
          bgcolor: "#1e1e1e",
          p: 1,
          overflow: "hidden",
        }}
      />
    </Box>
  );
};

export default Terminal;
