import React, { useState } from 'react';
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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MoreVertIcon from '@mui/icons-material/MoreVert';

const defaultCommands = [
  { id: 1, name: 'ls -la', command: 'ls -la', category: 'file' },
  { id: 2, name: 'pwd', command: 'pwd', category: 'file' },
  { id: 3, name: 'df -h', command: 'df -h', category: 'system' },
  { id: 4, name: 'free -m', command: 'free -m', category: 'system' },
  { id: 5, name: 'top', command: 'top', category: 'process' },
  { id: 6, name: 'ps aux', command: 'ps aux', category: 'process' },
  { id: 7, name: 'netstat -tulpn', command: 'netstat -tulpn', category: 'network' },
  { id: 8, name: 'ifconfig', command: 'ifconfig', category: 'network' },
  { id: 9, name: 'grep', command: 'grep ', category: 'text' },
  { id: 10, name: 'tail -f', command: 'tail -f ', category: 'file' },
];

const QuickCommand = ({ onCommand }) => {
  const [commands, setCommands] = useState(defaultCommands);
  const [filter, setFilter] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = ['all', ...new Set(commands.map(cmd => cmd.category))];

  const filteredCommands = commands.filter(cmd => {
    const matchesFilter = cmd.name.toLowerCase().includes(filter.toLowerCase()) ||
                         cmd.command.toLowerCase().includes(filter.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || cmd.category === selectedCategory;
    return matchesFilter && matchesCategory;
  });

  const handleCommandClick = (command) => {
    if (window.sendCommandToTerminal) {
      window.sendCommandToTerminal(command);
    }
  };

  const handleCopyCommand = (command) => {
    navigator.clipboard.writeText(command);
  };

  const handleAddCommand = () => {
    // Open dialog to add new command (simplified for demo)
    const newCommand = {
      id: commands.length + 1,
      name: 'New Command',
      command: 'echo "Hello"',
      category: 'custom',
    };
    setCommands([...commands, newCommand]);
  };

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      <Box sx={{ p: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
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
          
          <Box sx={{ display: 'flex', gap: 0.5, overflow: 'auto', flex: 1 }}>
            {categories.map(category => (
              <Chip
                key={category}
                label={category}
                size="small"
                onClick={() => setSelectedCategory(category)}
                color={selectedCategory === category ? 'primary' : 'default'}
                variant={selectedCategory === category ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
          
          <Tooltip title="Add Command">
            <IconButton size="small" onClick={handleAddCommand}>
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Box>
        
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            overflowX: 'auto',
            pb: 1,
            '&::-webkit-scrollbar': {
              height: 6,
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: 3,
            },
          }}
        >
          {filteredCommands.map((cmd) => (
            <Paper
              key={cmd.id}
              elevation={1}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                p: '2px 4px 2px 8px',
                borderRadius: 2,
                bgcolor: 'action.hover',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'action.selected',
                },
              }}
              onClick={() => handleCommandClick(cmd.command)}
            >
              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                {cmd.name}
              </Typography>
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
            </Paper>
          ))}
        </Box>
      </Box>
    </Paper>
  );
};

export default QuickCommand;