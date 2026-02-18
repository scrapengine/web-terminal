import asyncio
import asyncssh
from typing import Dict, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SSHManager:
    def __init__(self):
        self.connections: Dict[str, asyncssh.SSHClientConnection] = {}
        self.sessions: Dict[str, Dict] = {}
    
    async def create_connection(self, session_id: str, host: str, port: int, 
                                username: str, password: str) -> bool:
        try:
            conn = await asyncssh.connect(
                host=host,
                port=port,
                username=username,
                password=password,
                known_hosts=None
            )
            self.connections[session_id] = conn
            self.sessions[session_id] = {
                'host': host,
                'port': port,
                'username': username,
                'connected': True
            }
            logger.info(f"Connected to {host}:{port} as {username}")
            return True
        except Exception as e:
            logger.error(f"Connection failed: {str(e)}")
            return False
    
    async def execute_command(self, session_id: str, command: str) -> str:
        if session_id not in self.connections:
            return "Not connected to any server"
        
        try:
            conn = self.connections[session_id]
            result = await conn.run(command)
            return result.stdout
        except Exception as e:
            logger.error(f"Command execution failed: {str(e)}")
            return f"Error: {str(e)}"
    
    async def create_shell(self, session_id: str, websocket):
        if session_id not in self.connections:
            await websocket.send("Not connected")
            return
        
        try:
            conn = self.connections[session_id]
            async with conn.create_process() as process:
                async for line in process.stdout:
                    await websocket.send(line)
        except Exception as e:
            logger.error(f"Shell error: {str(e)}")
            await websocket.send(f"Shell error: {str(e)}")
    
    def disconnect(self, session_id: str):
        if session_id in self.connections:
            self.connections[session_id].close()
            del self.connections[session_id]
            self.sessions[session_id]['connected'] = False
            logger.info(f"Disconnected session {session_id}")
    
    def get_session_status(self, session_id: str) -> Dict:
        return self.sessions.get(session_id, {'connected': False})
    
    def get_all_sessions(self) -> Dict:
        return self.sessions

ssh_manager = SSHManager()