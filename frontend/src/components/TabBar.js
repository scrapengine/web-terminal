import React, { useEffect } from "react";
import { Box, Tab, Tabs, IconButton, Tooltip } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RefreshIcon from "@mui/icons-material/Refresh";

const TabBar = ({
  sessions,
  activeSession,
  onSelectSession,
  onCloseTab,
  onConnect,
  onDisconnect,
  onReconnect,
  setSessions,   // ⬅️ TAMBAHAN (optional kalau belum ada)
  userId         // ⬅️ TAMBAHAN
}) => {

  // ==============================
  // 🔥 FETCH HOSTS DARI BACKEND
  // ==============================
  useEffect(() => {
    if (!userId || !setSessions) return;

    const fetchHosts = async () => {
      try {
        const res = await fetch(`/api/hosts/${userId}`);
        const data = await res.json();

        if (Array.isArray(data)) {
          const mappedSessions = data.map((host) => ({
            id: host.id,
            host: host.hostname || host.host || `Host-${host.id}`,
            status: "disconnected",
          }));

          setSessions(mappedSessions);
        }
      } catch (err) {
        console.error("Failed to fetch hosts:", err);
      }
    };

    fetchHosts();
  }, [userId, setSessions]);

  // ==============================
  // EXISTING LOGIC (TIDAK DIUBAH)
  // ==============================

  const handleChange = (event, newValue) => {
    onSelectSession(newValue);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "connected":
        return "success";
      case "connecting":
        return "warning";
      case "error":
        return "error";
      default:
        return "disabled";
    }
  };

  const handleButtonClick = (e, callback, sessionId) => {
    e.stopPropagation();
    e.preventDefault();
    callback(sessionId);
  };

  return (
    <Box
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Tabs
        value={activeSession || false}
        onChange={handleChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 42,
          "& .MuiTabs-indicator": {
            height: 3,
            backgroundColor: "#22c55e",
          },
          "& .MuiTab-root": {
            minHeight: 42,
            textTransform: "none",
            fontSize: "0.8rem",
            color: "text.secondary",
            "&.Mui-selected": {
              color: "primary.main",
              backgroundColor: "#0b1220",
            },
          },
        }}
      >
        {sessions.map((session) => (
          <Tab
            key={session.id}
            value={session.id}
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <FiberManualRecordIcon
                  sx={{
                    fontSize: 12,
                    color: `${getStatusColor(session.status)}.main`,
                  }}
                />

                <span style={{ fontSize: "0.875rem" }}>{session.host}</span>

                <Box sx={{ display: "flex", gap: 0.5, ml: 1 }}>
                  {session.status !== "connected" && (
                    <Tooltip title="Connect">
                      <Box
                        component="span"
                        onClick={(e) =>
                          handleButtonClick(e, onConnect, session.id)
                        }
                        sx={{
                          display: "inline-flex",
                          cursor: "pointer",
                          p: 0.5,
                          borderRadius: 1,
                          "&:hover": {
                            bgcolor: "action.hover",
                          },
                        }}
                      >
                        <PlayArrowIcon fontSize="small" />
                      </Box>
                    </Tooltip>
                  )}
                  {session.status === "connected" && (
                    <>
                      <Tooltip title="Disconnect">
                        <Box
                          component="span"
                          onClick={(e) =>
                            handleButtonClick(e, onDisconnect, session.id)
                          }
                          sx={{
                            display: "inline-flex",
                            cursor: "pointer",
                            p: 0.5,
                            borderRadius: 1,
                            "&:hover": {
                              bgcolor: "action.hover",
                            },
                          }}
                        >
                          <StopIcon fontSize="small" />
                        </Box>
                      </Tooltip>
                      <Tooltip title="Reconnect">
                        <Box
                          component="span"
                          onClick={(e) =>
                            handleButtonClick(e, onReconnect, session.id)
                          }
                          sx={{
                            display: "inline-flex",
                            cursor: "pointer",
                            p: 0.5,
                            borderRadius: 1,
                            "&:hover": {
                              bgcolor: "action.hover",
                            },
                          }}
                        >
                          <RefreshIcon fontSize="small" />
                        </Box>
                      </Tooltip>
                    </>
                  )}
                  <Tooltip title="Close">
                    <Box
                      component="span"
                      onClick={(e) =>
                        handleButtonClick(e, onCloseTab, session.id)
                      }
                      sx={{
                        display: "inline-flex",
                        cursor: "pointer",
                        p: 0.5,
                        borderRadius: 1,
                        "&:hover": {
                          bgcolor: "action.hover",
                        },
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </Box>
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