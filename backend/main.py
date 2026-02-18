from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import asyncio
import json
import uuid
import asyncssh
from ssh_manager import ssh_manager

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

@app.post("/api/execute")
async def execute_command(command: SSHCommand):
    result = await ssh_manager.execute_command(command.session_id, command.command)
    return {"result": result}

@app.get("/api/sessions")
async def get_sessions():
    return ssh_manager.get_all_sessions()

@app.get("/api/session/{session_id}")
async def get_session(session_id: str):
    status = ssh_manager.get_session_status(session_id)
    return status

@app.websocket("/ws/terminal/{session_id}")
async def terminal_websocket(websocket: WebSocket, session_id: str):
    await websocket.accept()
    active_connections[session_id] = websocket
    
    try:
        if session_id not in ssh_manager.connections:
            await websocket.send(json.dumps({
                "type": "error",
                "data": "Not connected to any server"
            }))
            return
        
        conn = ssh_manager.connections[session_id]
        
        # Create interactive shell
        async with conn.create_process(term_type='xterm') as process:
            # Send initial message
            await websocket.send(json.dumps({
                "type": "data",
                "data": f"Connected to {ssh_manager.sessions[session_id]['host']}\r\n"
            }))
            
            # Task to read from process and send to websocket
            async def read_from_process():
                async for data in process.stdout:
                    try:
                        await websocket.send(json.dumps({
                            "type": "data",
                            "data": data
                        }))
                    except:
                        break
            
            # Task to read from websocket and write to process
            async def write_to_process():
                try:
                    async for message in websocket.iter_text():
                        data = json.loads(message)
                        if data['type'] == 'input':
                            process.stdin.write(data['data'])
                        elif data['type'] == 'resize':
                            # Handle terminal resize
                            process.change_terminal_size(
                                data.get('cols', 80),
                                data.get('rows', 24)
                            )
                        elif data['type'] == 'command':
                            # Send command as input
                            process.stdin.write(data['data'] + '\n')
                except:
                    pass
            
            # Run both tasks concurrently
            await asyncio.gather(
                read_from_process(),
                write_to_process()
            )
    
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
    finally:
        if session_id in active_connections:
            del active_connections[session_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)