from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import asyncio
import json
import uuid
import logging
from backend.ssh_manager import ssh_manager
from pydantic import BaseModel
from typing import List
import bcrypt

class HostResponse(BaseModel):
    id: int
    host: str
    port: int
    username: str
    password: str

    class Config:
        from_attributes = True

# ================= DATABASE IMPORTS =================
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base, relationship, Session
from passlib.context import CryptContext

# ================= QUICK COMMAND IMPORTS =================
from backend.models import QuickCommand  # IMPORT INI
from backend.schemas import (
    QuickCommandCreate, 
    QuickCommandUpdate, 
    QuickCommandResponse
)


# ================= LOGGING =================
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI(title="XShell Clone API")

# ================= CORS =================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= DATABASE SETUP =================

DATABASE_URL = "sqlite:///./database.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Ganti fungsi hash_password dan verify_password
def hash_password(password: str) -> str:
    """Hash password dengan bcrypt langsung"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifikasi password dengan bcrypt langsung"""
    return bcrypt.checkpw(
        plain_password.encode('utf-8'), 
        hashed_password.encode('utf-8')
    )

# ================= DATABASE MODELS =================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)

    ssh_hosts = relationship("SSHHost", back_populates="owner")


class SSHHost(Base):
    __tablename__ = "ssh_hosts"

    id = Column(Integer, primary_key=True, index=True)
    host = Column(String)
    port = Column(Integer, default=22)
    username = Column(String)
    password = Column(String)  # plaintext (dev mode)

    user_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="ssh_hosts")

# Create tables automatically
Base.metadata.create_all(bind=engine)

# ================= EXISTING MODELS =================

class SSHConnection(BaseModel):
    host: str
    port: int = 22
    username: str
    password: str

class SSHCommand(BaseModel):
    session_id: str
    command: str

# ================= AUTH ENDPOINTS =================

@app.post("/api/register")
def register(username: str, password: str, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == username).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    user = User(
        username=username,
        password_hash=hash_password(password)
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {"message": "User created"}


@app.post("/api/login")
def login(username: str, password: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()

    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    return {
        "message": "Login success",
        "user_id": user.id
    }

# ================= SSH HOST STORAGE =================

@app.post("/api/hosts")
def add_host(
    user_id: int,
    host: str,
    port: int,
    username: str,
    password: str,
    db: Session = Depends(get_db)
):
    new_host = SSHHost(
        host=host,
        port=port,
        username=username,
        password=password,
        user_id=user_id
    )

    db.add(new_host)
    db.commit()
    db.refresh(new_host)

    return {"message": "Host saved"}


@app.get("/api/hosts/{user_id}", response_model=List[HostResponse])
def get_hosts(user_id: int, db: Session = Depends(get_db)):
    hosts = db.query(SSHHost).filter(SSHHost.user_id == user_id).all()
    return hosts


@app.post("/api/connect-saved/{host_id}")
async def connect_saved_host(host_id: int, db: Session = Depends(get_db)):
    host = db.query(SSHHost).filter(SSHHost.id == host_id).first()

    if not host:
        raise HTTPException(status_code=404, detail="Host not found")

    session_id = str(uuid.uuid4())

    success = await ssh_manager.create_connection(
        session_id=session_id,
        host=host.host,
        port=host.port,
        username=host.username,
        password=host.password
    )

    if not success:
        raise HTTPException(status_code=400, detail="Connection failed")

    return {
        "session_id": session_id,
        "status": "connected"
    }

# ================= QUICK COMMAND ENDPOINTS =================

@app.get("/api/quick-commands/{user_id}", response_model=List[QuickCommandResponse])
async def get_quick_commands(
    user_id: int,
    db: Session = Depends(get_db)
):
    """Get all quick commands for user (including defaults)"""
    # Ambil command default (is_default=True) + command milik user
    commands = db.query(QuickCommand).filter(
        (QuickCommand.user_id == user_id) | (QuickCommand.is_default == True)
    ).order_by(QuickCommand.sort_order).all()
    
    return commands


@app.post("/api/quick-commands", response_model=QuickCommandResponse)
async def add_quick_command(
    user_id: int,
    command: QuickCommandCreate,
    db: Session = Depends(get_db)
):
    """Add custom quick command"""
    new_command = QuickCommand(
        user_id=user_id,
        name=command.name,
        command=command.command,
        category=command.category,
        sort_order=command.sort_order,
        is_default=False
    )
    
    db.add(new_command)
    db.commit()
    db.refresh(new_command)
    
    return new_command


@app.put("/api/quick-commands/{command_id}", response_model=QuickCommandResponse)
async def update_quick_command(
    command_id: int,
    command: QuickCommandUpdate,
    user_id: int,
    db: Session = Depends(get_db)
):
    """Update custom quick command"""
    db_command = db.query(QuickCommand).filter(
        QuickCommand.id == command_id,
        QuickCommand.user_id == user_id,
        QuickCommand.is_default == False  # Tidak bisa update default command
    ).first()
    
    if not db_command:
        raise HTTPException(status_code=404, detail="Command not found")
    
    db_command.name = command.name
    db_command.command = command.command
    db_command.category = command.category
    db_command.sort_order = command.sort_order
    
    db.commit()
    db.refresh(db_command)
    
    return db_command


@app.delete("/api/quick-commands/{command_id}")
async def delete_quick_command(
    command_id: int,
    user_id: int,
    db: Session = Depends(get_db)
):
    """Delete custom quick command"""
    db_command = db.query(QuickCommand).filter(
        QuickCommand.id == command_id,
        QuickCommand.user_id == user_id,
        QuickCommand.is_default == False
    ).first()
    
    if not db_command:
        raise HTTPException(status_code=404, detail="Command not found")
    
    db.delete(db_command)
    db.commit()
    
    return {"message": "Command deleted"}


@app.post("/api/quick-commands/seed-defaults")
async def seed_default_commands(db: Session = Depends(get_db)):
    """Seed default quick commands (untuk inisialisasi)"""
    default_commands = [
        {"name": "ls -la", "command": "ls -la", "category": "file", "sort_order": 1},
        {"name": "pwd", "command": "pwd", "category": "file", "sort_order": 2},
        {"name": "df -h", "command": "df -h", "category": "system", "sort_order": 3},
        {"name": "free -m", "command": "free -m", "category": "system", "sort_order": 4},
        {"name": "top", "command": "top", "category": "process", "sort_order": 5},
        {"name": "ps aux", "command": "ps aux", "category": "process", "sort_order": 6},
        {"name": "netstat -tulpn", "command": "netstat -tulpn", "category": "network", "sort_order": 7},
        {"name": "ifconfig", "command": "ifconfig", "category": "network", "sort_order": 8},
        {"name": "grep", "command": "grep ", "category": "text", "sort_order": 9},
        {"name": "tail -f", "command": "tail -f ", "category": "file", "sort_order": 10},
    ]
    
    for cmd in default_commands:
        exists = db.query(QuickCommand).filter(
            QuickCommand.name == cmd["name"],
            QuickCommand.is_default == True
        ).first()
        
        if not exists:
            db_command = QuickCommand(
                user_id=0,  # system user
                name=cmd["name"],
                command=cmd["command"],
                category=cmd["category"],
                sort_order=cmd["sort_order"],
                is_default=True
            )
            db.add(db_command)
    
    db.commit()
    return {"message": "Default commands seeded"}

@app.put("/api/hosts/{host_id}")
def update_host(
    host_id: int,
    user_id: int,
    host: str,
    port: int,
    username: str,
    password: str,
    db: Session = Depends(get_db)
):
    db_host = db.query(SSHHost).filter(
        SSHHost.id == host_id,
        SSHHost.user_id == user_id
    ).first()
    
    if not db_host:
        raise HTTPException(status_code=404, detail="Host not found")
    
    db_host.host = host
    db_host.port = port
    db_host.username = username
    db_host.password = password
    
    db.commit()
    db.refresh(db_host)
    
    return {"message": "Host updated successfully"}

@app.delete("/api/hosts/{host_id}")
def delete_host(
    host_id: int,
    user_id: int,
    db: Session = Depends(get_db)
):
    db_host = db.query(SSHHost).filter(
        SSHHost.id == host_id,
        SSHHost.user_id == user_id
    ).first()
    
    if not db_host:
        raise HTTPException(status_code=404, detail="Host not found")
    
    db.delete(db_host)
    db.commit()
    
    return {"message": "Host deleted successfully"}

@app.post("/api/connect-local")
async def connect_local():
    """Connect ke terminal lokal"""
    session_id = str(uuid.uuid4())
    
    success = await ssh_manager.create_local_shell(session_id)
    
    if success:
        return {
            "session_id": session_id,
            "status": "connected",
            "message": "Connected to local terminal",
            "is_local": True
        }
    else:
        raise HTTPException(status_code=400, detail="Failed to start local terminal")

# ================= EXISTING SSH SYSTEM (UNCHANGED) =================

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
    # 🔥 CEK APAKAH SUDAH ADA KONEKSI AKTIF UNTUK SESSION INI
    if hasattr(terminal_websocket, "active_connections") and session_id in terminal_websocket.active_connections:
        logger.warning(f"Session {session_id} already has active connection, rejecting new one")
        await websocket.close(code=1008, reason="Session already connected")
        return
    
    # Inisialisasi set active connections jika belum ada
    if not hasattr(terminal_websocket, "active_connections"):
        terminal_websocket.active_connections = set()
    
    terminal_websocket.active_connections.add(session_id)
    
    await websocket.accept()
    logger.info(f"WebSocket connected for session {session_id}")

    try:
        # 🔥 CEK APAKAH INI LOCAL SESSION (TAMBAHAN BARU)
        if session_id in ssh_manager.local_sessions:
            await ssh_manager.handle_local_shell(session_id, websocket)
            return

        # 🔥 EXISTING CODE - TIDAK DIUBAH
        if session_id not in ssh_manager.connections:
            await websocket.send_json({
                "type": "error",
                "data": "Session not found"
            })
            await websocket.close()
            return

        conn = ssh_manager.connections[session_id]

        try:
            process = await conn.create_process(
                term_type="xterm",
                term_size=(80, 24)
            )

            logger.info("PTY process started")

            async def read_from_shell():
                try:
                    while True:
                        data = await process.stdout.read(1024)
                        if not data:
                            break
                        await websocket.send_json({
                            "type": "data",
                            "data": data
                        })
                except Exception as e:
                    logger.error(f"Read error: {e}")

            async def write_to_shell():
                try:
                    async for message in websocket.iter_json():
                        if message["type"] == "input":
                            process.stdin.write(message["data"])
                            await process.stdin.drain()

                        elif message["type"] == "resize":
                            cols = int(message.get("cols", 80))
                            rows = int(message.get("rows", 24))
                            process.change_terminal_size(cols, rows)

                except Exception as e:
                    logger.error(f"Write error: {e}")

            await asyncio.gather(
                read_from_shell(),
                write_to_shell()
            )

        except Exception as e:
            logger.error(f"Terminal error: {e}")
            await websocket.send_json({
                "type": "error",
                "data": str(e)
            })

        finally:
            try:
                process.close()
                await process.wait_closed()
            except:
                pass

    finally:
        # 🔥 HAPUS DARI ACTIVE CONNECTIONS SAAT KONEKSI DITUTUP
        if hasattr(terminal_websocket, "active_connections") and session_id in terminal_websocket.active_connections:
            terminal_websocket.active_connections.remove(session_id)
        logger.info(f"Session {session_id} closed")