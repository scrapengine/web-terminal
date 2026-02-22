import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  IconButton,
  Tooltip,
  Chip,
  Typography,
  Fab,
  Snackbar,
  Alert,
} from "@mui/material";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";
import RefreshIcon from "@mui/icons-material/Refresh";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";

const Terminal = ({ session }) => {
  const terminalRef = useRef(null);
  const terminalInstance = useRef(null);
  const fitAddon = useRef(null);
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("disconnected");
  const [hasSelection, setHasSelection] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // Deteksi apakah perangkat mobile
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    if (!session.connected || !session.backendId) return;

    // 🔥 CEK APAKAH SUDAH ADA WEBSOCKET YANG AKTIF
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected, skipping creation");
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
      console.log("WebSocket is connecting, waiting...");
      return;
    }

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
          handleCopyToClipboard(selection);
          return false;
        }
      }

      // Ctrl + V → Paste
      if (event.ctrlKey && event.key === "v") {
        handlePasteFromClipboard();
        return false;
      }

      return true;
    });

    // =========================
    // WEBSOCKET - HANYA SATU KALI
    // =========================
    setStatus("connecting");

    const ws = new WebSocket(
      `ws://localhost:8000/ws/terminal/${session.backendId}`,
    );
    wsRef.current = ws;

    // 🔥 FLAG UNTUK MENCEGAH MULTIPLE EVENT
    let connectionEstablished = false;

    ws.onopen = () => {
      if (connectionEstablished) return;
      connectionEstablished = true;

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
      if (!connectionEstablished) return;
      connectionEstablished = false;

      setConnected(false);
      setStatus("disconnected");
      term.writeln("\r\n\x1b[31mDisconnected from server\x1b[0m\r\n");
    };

    ws.onmessage = (event) => {
      if (!connectionEstablished) return;
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
      if (!connectionEstablished) return;
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
    // TAMBAHAN UNTUK TOUCH SELECTION (HP)
    // =========================
    term.onSelectionChange(() => {
      const selected = term.getSelection();
      setHasSelection(selected.length > 0);
    });

    // =========================
    // 🔥 EXPOSE FUNCTION UNTUK QUICK COMMANDS
    // =========================
    window.sendCommandToTerminal = (command) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "input",
            data: command,
          }),
        );

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
      window.sendCommandToTerminal = null;

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      term.dispose();
    };
  }, [session.connected, session.backendId]);

  // =========================
  // FUNGSI CLIPBOARD DENGAN FALLBACK
  // =========================
  const handleCopyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showSnackbar("✅ Teks disalin ke clipboard");
    } catch (err) {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        showSnackbar("✅ Teks disalin (fallback)");
      } catch (fallbackErr) {
        console.error("Copy failed:", fallbackErr);
        showSnackbar("❌ Gagal menyalin teks", "error");
      }
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "input",
            data: text,
          }),
        );
        showSnackbar("✅ Teks ditempel");
      }
    } catch (err) {
      if (isMobile) {
        const pastedText = prompt("Tempel teks Anda di sini:");
        if (pastedText && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "input",
              data: pastedText,
            }),
          );
          showSnackbar("✅ Teks ditempel");
        }
      } else {
        showSnackbar("❌ Tidak bisa mengakses clipboard", "error");
      }
    }
  };

  const showSnackbar = (message, severity = "success") => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
    setTimeout(() => setSnackbarOpen(false), 2000);
  };

  const handleCopySelection = () => {
    const selection = terminalInstance.current?.getSelection();
    if (selection) {
      handleCopyToClipboard(selection);
    } else {
      showSnackbar("❌ Tidak ada teks yang dipilih", "warning");
    }
  };

  const handlePaste = () => {
    handlePasteFromClipboard();
  };

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
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
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

      {/* FLOATING ACTION BUTTONS UNTUK COPY/PASTE */}
      {hasSelection && (
        <Fab
          color="primary"
          size="small"
          sx={{
            position: "absolute",
            bottom: 16,
            right: 16,
            zIndex: 1000,
          }}
          onClick={handleCopySelection}
          title="Copy selected text"
        >
          <ContentCopyIcon />
        </Fab>
      )}

      <Fab
        color="secondary"
        size="small"
        sx={{
          position: "absolute",
          bottom: hasSelection ? 80 : 16,
          right: 16,
          zIndex: 1000,
        }}
        onClick={handlePaste}
        title="Paste"
      >
        <ContentPasteIcon />
      </Fab>

      {/* Snackbar untuk notifikasi */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2000}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbarMessage.includes("✅") ? "success" : "error"}
          sx={{ width: "100%" }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Terminal;
