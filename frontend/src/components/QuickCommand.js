import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Chip,
  TextField,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Snackbar,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import axios from "axios";

const API_URL = "http://localhost:8000/api";

const QuickCommand = ({ userId }) => {
  const [commands, setCommands] = useState([]);
  const [filter, setFilter] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedCommand, setSelectedCommand] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    command: "",
    category: "custom",
    sort_order: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load commands dari database
  useEffect(() => {
    if (userId) {
      loadCommands();
    }
  }, [userId]);

  const loadCommands = async () => {
    try {
      const response = await axios.get(`${API_URL}/quick-commands/${userId}`);
      setCommands(response.data);
    } catch (err) {
      console.error("Failed to load quick commands:", err);
    }
  };

  const categories = ["all", ...new Set(commands.map((cmd) => cmd.category))];

  const filteredCommands = commands.filter((cmd) => {
    const matchesFilter =
      cmd.name.toLowerCase().includes(filter.toLowerCase()) ||
      cmd.command.toLowerCase().includes(filter.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || cmd.category === selectedCategory;
    return matchesFilter && matchesCategory;
  });

  const handleCommandClick = (command) => {
    if (window.sendCommandToTerminal) {
      // Kirim command apa adanya, nanti Terminal.js yang handle
      window.sendCommandToTerminal(command.command);
    }
  };

  const handleCopyCommand = (command) => {
    navigator.clipboard.writeText(command);
  };

  const handleMenuOpen = (event, cmd) => {
    setAnchorEl(event.currentTarget);
    setSelectedCommand(cmd);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedCommand(null);
  };

  const handleEdit = () => {
    if (!selectedCommand) {
      console.error("No command selected");
      return;
    }

    // console.log("Editing command:", selectedCommand);

    setEditingId(selectedCommand.id); // ← SIMPAN ID
    setFormData({
      name: selectedCommand.name || "",
      command: selectedCommand.command || "",
      category: selectedCommand.category || "custom",
      sort_order: selectedCommand.sort_order || 0,
    });
    setEditMode(true);
    setOpenDialog(true);
    handleMenuClose();
  };

  const handleDelete = async () => {
    if (!selectedCommand || selectedCommand.is_default) {
      alert("Cannot delete default commands");
      handleMenuClose();
      return;
    }

    try {
      await axios.delete(`${API_URL}/quick-commands/${selectedCommand.id}`, {
        params: { user_id: userId },
      });
      await loadCommands();
      setSuccess("Command deleted successfully");
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      console.error("Failed to delete command:", err);
      alert("Failed to delete command");
    }
    handleMenuClose();
  };

  const handleAddNew = () => {
    setFormData({
      name: "",
      command: "",
      category: "custom",
      sort_order: commands.length,
    });
    setEditMode(false);
    setOpenDialog(true);
  };

  const handleSave = async (event) => {
    event.preventDefault(); 
    setLoading(true);
    setError("");

    try {
      if (!formData.name || !formData.command) {
        setError("Name and command are required");
        setLoading(false);
        return;
      }

      if (!userId) {
        setError("User ID not found. Please login again.");
        setLoading(false);
        return;
      }

      // Data yang akan dikirim sebagai JSON
      const commandData = {
        user_id: parseInt(userId),
        name: formData.name.trim(),
        command: formData.command.trim(),
        category: formData.category.trim() || "custom",
        sort_order: parseInt(formData.sort_order) || 0,
      };

      // console.log("Sending with data:", commandData);

      if (editMode) {
        if (!editingId) {
          setError("No command selected for editing");
          setLoading(false);
          return;
        }

        const updateData = {
          id: editingId, // ← PAKAI editingId, BUKAN selectedCommand.id
          name: formData.name.trim(),
          command: formData.command.trim(),
          category: formData.category.trim() || "custom",
          sort_order: parseInt(formData.sort_order) || 0,
        };

        // console.log("Updating with data:", updateData);

        await axios.put(
          `${API_URL}/quick-commands/${editingId}`, // ← PAKAI editingId
          updateData,
          {
            params: {
              user_id: parseInt(userId),
            },
          },
        );
        setSuccess("Command updated successfully");
      } else {
        // CREATE - POST dengan JSON body
        await axios.post(`${API_URL}/quick-commands`, commandData, {
          params: {
            user_id: userId,
          },
        });
        setSuccess("Command added successfully");
      }

      await loadCommands();
      setOpenDialog(false);
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      console.error("❌ Error response:", err.response?.data);
      console.error("❌ Status:", err.response?.status);

      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          const messages = err.response.data.detail
            .map((d) => {
              return `${d.loc.join(".")}: ${d.msg}`;
            })
            .join(", ");
          setError(messages);
        } else {
          setError(err.response.data.detail);
        }
      } else {
        setError(err.message || "Failed to save command");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditMode(false);
    setEditingId(null); // ← RESET
    setFormData({
      name: "",
      command: "",
      category: "custom",
      sort_order: 0,
    });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <>
      <Paper
        elevation={3}
        sx={{
          position: "sticky",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          bgcolor: "background.paper",
          borderTop: 1,
          borderColor: "divider",
        }}
      >
        <Box sx={{ p: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 1, gap: 1 }}>
            <Typography variant="subtitle2" sx={{ minWidth: 100 }}>
              Quick Commands
            </Typography>

            <TextField
              size="small"
              placeholder="Filter commands..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              sx={{ flex: 1, maxWidth: 300 }}
            />

            <Box sx={{ display: "flex", gap: 0.5, overflow: "auto", flex: 1 }}>
              {categories.map((category) => (
                <Chip
                  key={category}
                  label={category}
                  size="small"
                  onClick={() => setSelectedCategory(category)}
                  color={selectedCategory === category ? "primary" : "default"}
                  variant={
                    selectedCategory === category ? "filled" : "outlined"
                  }
                />
              ))}
            </Box>

            <Tooltip title="Add Command">
              <IconButton size="small" onClick={handleAddNew}>
                <AddIcon />
              </IconButton>
            </Tooltip>
          </Box>

          <Box
            sx={{
              display: "flex",
              gap: 1,
              overflowX: "auto",
              pb: 1,
              "&::-webkit-scrollbar": {
                height: 6,
              },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: 3,
              },
            }}
          >
            {filteredCommands.map((cmd) => (
              <Paper
                key={cmd.id}
                elevation={1}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                  p: "2px 4px 2px 8px",
                  borderRadius: 2,
                  bgcolor: cmd.is_default ? "action.selected" : "action.hover",
                  cursor: "pointer",
                  "&:hover": {
                    bgcolor: "action.focus",
                  },
                }}
              >
                <Box
                  sx={{ display: "flex", alignItems: "center" }}
                  onClick={() => handleCommandClick(cmd)}
                >
                  <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                    {cmd.name}
                  </Typography>
                </Box>

                <Tooltip title="Copy">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyCommand(cmd.command);
                    }}
                    sx={{ p: 0.5 }}
                  >
                    <ContentCopyIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>

                {!cmd.is_default && (
                  <Tooltip title="More">
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, cmd)}
                      sx={{ p: 0.5 }}
                    >
                      <MoreVertIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Paper>
            ))}
          </Box>
        </Box>
      </Paper>

      {/* Menu for edit/delete */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <EditIcon sx={{ mr: 1, fontSize: 18 }} /> Edit
        </MenuItem>
        <MenuItem onClick={handleDelete}>
          <DeleteIcon sx={{ mr: 1, fontSize: 18 }} /> Delete
        </MenuItem>
      </Menu>

      {/* Add/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editMode ? "Edit Quick Command" : "Add Quick Command"}
        </DialogTitle>

        {/* FORM WRAPPER - tambahkan component="form" di sini */}
        <Box component="form" onSubmit={handleSave}>
          <DialogContent sx={{ pt: 2, pb: 1 }}>
            <TextField
              autoFocus
              margin="dense"
              name="name"
              label="Command Name"
              fullWidth
              value={formData.name}
              onChange={handleChange}
              required
              size="small"
              sx={{ mb: 1.5 }}
            />
            <TextField
              margin="dense"
              name="command"
              label="Command"
              fullWidth
              multiline
              rows={2}
              value={formData.command}
              onChange={handleChange}
              required
              size="small"
              sx={{ mb: 1.5 }}
            />
            <TextField
              margin="dense"
              name="category"
              label="Category"
              fullWidth
              value={formData.category}
              onChange={handleChange}
              size="small"
              sx={{ mb: 1 }}
            />
            {error && (
              <Alert severity="error" sx={{ mt: 1, mb: 1 }}>
                {error}
              </Alert>
            )}
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 3, pt: 1 }}>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Snackbar
        open={!!success}
        autoHideDuration={3000}
        onClose={() => setSuccess("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success">{success}</Alert>
      </Snackbar>
    </>
  );
};

export default QuickCommand;
