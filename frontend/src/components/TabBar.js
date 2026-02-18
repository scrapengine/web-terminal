import React from 'react';
import { Box, Tab, Tabs, IconButton, Badge, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import RefreshIcon from '@mui/icons-material/Refresh';

const TabBar = ({
  sessions,
  activeSession,
  onSelectSession,
  onCloseTab,
  onConnect,
  onDisconnect,
  onReconnect,
}) => {
  const handleChange = (event, newValue) => {
    onSelectSession(newValue);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
        return 'success';
      case 'connecting':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'disabled';
    }
  };

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Tabs
        value={activeSession}
        onChange={handleChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          '& .MuiTab-root': {
            minHeight: 48,
            textTransform: 'none',
          },
        }}
      >
        {sessions.map((session) => (
          <Tab
            key={session.id}
            value={session.id}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title={`Status: ${session.status || 'disconnected'}`}>
                  <FiberManualRecordIcon
                    sx={{
                      fontSize: 12,
                      color: `${getStatusColor(session.status)}.main`,
                    }}
                  />
                </Tooltip>
                <span>{session.host}</span>
                <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                  {session.status !== 'connected' && (
                    <Tooltip title="Connect">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onConnect(session.id);
                        }}
                        sx={{ p: 0.5 }}
                      >
                        <PlayArrowIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {session.status === 'connected' && (
                    <>
                      <Tooltip title="Disconnect">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDisconnect(session.id);
                          }}
                          sx={{ p: 0.5 }}
                        >
                          <StopIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Reconnect">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onReconnect(session.id);
                          }}
                          sx={{ p: 0.5 }}
                        >
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                  <Tooltip title="Close">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab(session.id);
                      }}
                      sx={{ p: 0.5 }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            }
          />
        ))}
      </Tabs>
    </Box>
  );
};

export default TabBar;