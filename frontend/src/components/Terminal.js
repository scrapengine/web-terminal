import React, { useEffect, useRef, useState } from 'react';
import { Box, IconButton, Tooltip, Chip } from '@mui/material';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import RefreshIcon from '@mui/icons-material/Refresh';
import LinkOffIcon from '@mui/icons-material/LinkOff';

const Terminal = ({ session, onQuickCommand }) => {
  const terminalRef = useRef(null);
  const terminalInstance = useRef(null);
  const fitAddon = useRef(null);
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('disconnected');

  useEffect(() => {
    if (!session.connected) {
      setConnected(false);
      setStatus('disconnected');
      if (wsRef.current) {
        wsRef.current.close();
      }
      return;
    }

    // Initialize terminal
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#f0f0f0',
        cursor: '#f0f0f0',
        selection: 'rgba(255,255,255,0.3)',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      rows: 30,
      cols: 80,
    });

    // Add addons
    fitAddon.current = new FitAddon();
    term.loadAddon(fitAddon.current);
    term.loadAddon(new WebLinksAddon());

    // Open terminal
    term.open(terminalRef.current);
    fitAddon.current.fit();

    // Handle resize
    const handleResize = () => {
      fitAddon.current.fit();
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const dimensions = fitAddon.current.proposeDimensions();
        wsRef.current.send(JSON.stringify({
          type: 'resize',
          cols: dimensions.cols,
          rows: dimensions.rows
        }));
      }
    };
    window.addEventListener('resize', handleResize);

    // Connect WebSocket
    if (session.backendId) {
      setStatus('connecting');
      const ws = new WebSocket(`ws://localhost:8000/ws/terminal/${session.backendId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setStatus('connected');
        term.writeln('\x1b[32mConnected to server\x1b[0m\r\n');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'data') {
          term.write(data.data);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        setStatus('disconnected');
        term.writeln('\x1b[31m\r\nDisconnected from server\x1b[0m\r\n');
      };

      ws.onerror = (error) => {
        setStatus('error');
        term.writeln('\x1b[31m\r\nConnection error\x1b[0m\r\n');
      };

      // Handle terminal input
      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'input',
            data: data
          }));
        }
      });
    }

    terminalInstance.current = term;

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (wsRef.current) {
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
      // This allows parent to send commands to this terminal
      window.sendCommandToTerminal = (command) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'command',
            data: command
          }));
          terminalInstance.current.write(command + '\r\n');
        }
      };
    }
  }, [onQuickCommand]);

  const handleReconnect = () => {
    // This will be handled by parent
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
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 1,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            size="small"
            label={status}
            color={status === 'connected' ? 'success' : status === 'connecting' ? 'warning' : 'error'}
            variant="outlined"
          />
          <Typography variant="body2" color="text.secondary">
            {session.host}:{session.port} as {session.username}
          </Typography>
        </Box>
        
        <Box>
          <Tooltip title="Reconnect">
            <IconButton size="small" onClick={handleReconnect} disabled={connected}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Disconnect">
            <IconButton size="small" onClick={handleDisconnect} disabled={!connected}>
              <LinkOffIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      <Box
        ref={terminalRef}
        sx={{
          flex: 1,
          bgcolor: '#1e1e1e',
          p: 1,
          overflow: 'hidden',
        }}
      />
    </Box>
  );
};

export default Terminal;