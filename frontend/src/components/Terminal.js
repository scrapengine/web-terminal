import React, { useEffect, useRef, useState } from "react";
import { Box, IconButton, Tooltip, Chip, Typography } from "@mui/material";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";
import RefreshIcon from "@mui/icons-material/Refresh";
import LinkOffIcon from "@mui/icons-material/LinkOff";

const Terminal = ({ session }) => {
  const terminalRef = useRef(null);
  const terminalInstance = useRef(null);
  const fitAddon = useRef(null);
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("disconnected");

  useEffect(() => {
    if (!session.connected || !session.backendId) return;

    // =========================
    // INIT TERMINAL
    // =========================
    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      scrollback: 2000,
      theme: {
        background: "#1e1e1e",
        foreground: "#f0f0f0",
        cursor: "#f0f0f0",
        selectionBackground: "#264f78",
      },
    });

    fitAddon.current = new FitAddon();
    term.loadAddon(fitAddon.current);
    term.loadAddon(new WebLinksAddon());

    // Buka terminal
    term.open(terminalRef.current);
    terminalInstance.current = term;

    // 🔥 TUNGGU RENDERER SIAP
    setTimeout(() => {
      try {
        fitAddon.current?.fit();
        term.focus();
      } catch (e) {
        setTimeout(() => {
          try {
            fitAddon.current?.fit();
            term.focus();
          } catch (e2) {
            console.log("Final fit error:", e2);
          }
        }, 200);
      }
    }, 300);

    // =========================
    // COPY SUPPORT (PC + HP)
    // =========================
    term.attachCustomKeyEventHandler((event) => {
      // Ctrl + C → Copy
      if (event.ctrlKey && event.key === "c") {
        const selection = term.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
          return false;
        }
      }

      // Ctrl + V → Paste
      if (event.ctrlKey && event.key === "v") {
        navigator.clipboard.readText().then((text) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "input",
                data: text,
              }),
            );
          }
        });
        return false;
      }

      return true;
    });

    // =========================
    // WEBSOCKET
    // =========================
    setStatus("connecting");

    const ws = new WebSocket(
      `ws://localhost:8000/ws/terminal/${session.backendId}`,
    );
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setStatus("connected");

      setTimeout(() => {
        if (fitAddon.current && ws.readyState === WebSocket.OPEN) {
          const dimensions = fitAddon.current.proposeDimensions();
          if (dimensions?.cols && dimensions?.rows) {
            ws.send(
              JSON.stringify({
                type: "resize",
                cols: Math.floor(dimensions.cols),
                rows: Math.floor(dimensions.rows),
              }),
            );
          }
        }
      }, 300);
    };

    ws.onclose = () => {
      setConnected(false);
      setStatus("disconnected");
      term.writeln("\r\n\x1b[31mDisconnected from server\x1b[0m\r\n");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "data" && terminalInstance.current) {
          terminalInstance.current.write(data.data);
        }
      } catch (e) {
        console.error("WS parse error:", e);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setStatus("error");
      terminalInstance.current?.writeln(
        "\r\n\x1b[31mConnection error\x1b[0m\r\n",
      );
    };

    // =========================
    // INPUT → SEND TO SERVER
    // =========================
    term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "input",
            data: data,
          }),
        );
      }
    });

    // =========================
    // 🔥 EXPOSE FUNCTION UNTUK QUICK COMMANDS
    // =========================
    window.sendCommandToTerminal = (command) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // console.log("Sending quick command:", command);

        // Kirim perintah ke server
        wsRef.current.send(
          JSON.stringify({
            type: "input",
            data: command,
          }),
        );

        // Jika command tidak diakhiri newline, tambahkan enter
        if (!command.endsWith("\n") && !command.endsWith("\r")) {
          setTimeout(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({
                  type: "input",
                  data: "\n",
                }),
              );
            }
          }, 50);
        }
      } else {
        console.warn("⚠️ Terminal not connected");
      }
    };

    // =========================
    // RESIZE HANDLER
    // =========================
    const handleResize = () => {
      fitAddon.current?.fit();

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const dimensions = fitAddon.current.proposeDimensions();
        if (dimensions?.cols && dimensions?.rows) {
          wsRef.current.send(
            JSON.stringify({
              type: "resize",
              cols: Math.floor(dimensions.cols),
              rows: Math.floor(dimensions.rows),
            }),
          );
        }
      }
    };

    window.addEventListener("resize", handleResize);

    // =========================
    // CLEANUP
    // =========================
    return () => {
      window.removeEventListener("resize", handleResize);

      // Bersihkan function quick command
      window.sendCommandToTerminal = null;

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }

      term.dispose();
    };
  }, [session.connected, session.backendId]);

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
            {session.isLocal
              ? `Local Terminal (${session.username})`
              : `${session.host}:${session.port} as ${session.username}`}
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
          "& .xterm": {
            height: "100%",
          },
        }}
        onClick={() => terminalInstance.current?.focus()}
      />
    </Box>
  );
};

export default Terminal;
