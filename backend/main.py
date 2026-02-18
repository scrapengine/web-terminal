from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import asyncio
import json
import uuid
import logging
from ssh_manager import ssh_manager

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI(title="XShell Clone API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class SSHConnection(BaseModel):
    host: str
    port: int = 22
    username: str
    password: str

class SSHCommand(BaseModel):
    session_id: str
    command: str

# Store active WebSocket connections
active_connections = {}

@app.get("/")
async def root():
    return {"message": "XShell Clone API is running"}

@app.post("/api/connect")
async def connect_ssh(connection: SSHConnection):
    session_id = str(uuid.uuid4())
    
    success = await ssh_manager.create_connection(
        session_id=session_id,
        host=connection.host,
        port=connection.port,
        username=connection.username,
        password=connection.password
    )
    
    if success:
        return {
            "session_id": session_id,
            "status": "connected",
            "message": f"Connected to {connection.host}"
        }
    else:
        raise HTTPException(status_code=400, detail="Connection failed")

@app.post("/api/disconnect/{session_id}")
async def disconnect_ssh(session_id: str):
    ssh_manager.disconnect(session_id)
    return {"status": "disconnected"}

@app.get("/api/sessions")
async def get_sessions():
    return ssh_manager.get_all_sessions()

@app.get("/api/session/{session_id}")
async def get_session(session_id: str):
    return ssh_manager.get_session_status(session_id)

@app.websocket("/ws/terminal/{session_id}")
async def terminal_websocket(websocket: WebSocket, session_id: str):
    await websocket.accept()
    logger.info(f"WebSocket connected for session {session_id}")
    
    try:
        # Cek apakah session ada
        if session_id not in ssh_manager.connections:
            await websocket.send_json({
                "type": "error",
                "data": "Session not found"
            })
            await websocket.close()
            return
        
        conn = ssh_manager.connections[session_id]
        session_info = ssh_manager.sessions.get(session_id, {})
        
        # Buat shell interactive
        try:
            # Buka shell dengan terminal type yang benar
            process = await conn.create_process(
                    term_type='xterm-256color',
                    env={'TERM': 'xterm-256color'}  # Ini parameter yang benar untuk environment
                )
            
            logger.info(f"Shell created for session {session_id}")
            
            # Kirim welcome message
            await websocket.send_json({
                "type": "data",
                "data": f"\r\n\u001b[1;32mConnected to {session_info.get('host', 'unknown')}\u001b[0m\r\n"
            })
            
            await websocket.send_json({
                "type": "data",
                "data": "\u001b[1;34mType 'exit' to close connection\u001b[0m\r\n\r\n"
            })
            
            # Task untuk baca dari process dan kirim ke websocket
            async def read_from_shell():
                try:
                    async for data in process.stdout:
                        if data:
                            logger.debug(f"Sending data: {data[:50]}...")
                            await websocket.send_json({
                                "type": "data",
                                "data": data
                            })
                except Exception as e:
                    logger.error(f"Error reading from shell: {e}")
            
            # Task untuk baca dari websocket dan kirim ke process
            async def write_to_shell():
                try:
                    async for message in websocket.iter_json():
                        logger.debug(f"Received from client: {message}")
                        
                        if message['type'] == 'input':
                            # Kirim input ke shell
                            process.stdin.write(message['data'])
                            
                            # Jika input adalah 'exit', tutup koneksi
                            if message['data'] == 'exit\r':
                                await asyncio.sleep(0.5)
                                break
                                
                        elif message['type'] == 'resize':
                            # Handle terminal resize
                            try:
                                process.change_terminal_size(
                                    message.get('cols', 80),
                                    message.get('rows', 24)
                                )
                            except Exception as e:
                                logger.error(f"Resize error: {e}")
                        
                        elif message['type'] == 'command':
                            # Kirim command + newline
                            process.stdin.write(message['data'] + '\n')
                            
                except Exception as e:
                    logger.error(f"Error writing to shell: {e}")
            
            # Jalankan kedua task concurrently
            await asyncio.gather(
                read_from_shell(),
                write_to_shell()
            )
            
        except Exception as e:
            logger.error(f"Error creating shell: {e}")
            await websocket.send_json({
                "type": "error",
                "data": f"Failed to create shell: {str(e)}"
            })
        finally:
            # Cleanup process
            if 'process' in locals():
                process.close()
                await process.wait_closed()
    
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        if session_id in active_connections:
            del active_connections[session_id]
        logger.info(f"Cleaned up session {session_id}")