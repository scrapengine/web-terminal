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
            logger.info(f"Attempting to connect to {host}:{port} as {username}")
            
            # Method 1: Coba dengan opsi minimal dulu
            try:
                conn = await asyncssh.connect(
                    host=host,
                    port=port,
                    username=username,
                    password=password,
                    known_hosts=None,  # Kunci utama!
                    connect_timeout=30
                )
                
                logger.info(f"✅ Connected to {host}:{port}")
                
                self.connections[session_id] = conn
                self.sessions[session_id] = {
                    'host': host,
                    'port': port,
                    'username': username,
                    'connected': True
                }
                
                return True
                
            except asyncssh.Error as e:
                logger.error(f"Method 1 failed: {e}")
                
                # Method 2: Coba dengan opsi yang lebih lengkap
                logger.info("Trying method 2 with more options...")
                
                options = {
                    'host': host,
                    'port': port,
                    'username': username,
                    'password': password,
                    'known_hosts': None,
                    'connect_timeout': 30,
                    'keepalive_interval': 15,
                    'kex_algs': None,  # Biarkan asyncssh memilih
                    'encryption_algs': None,
                    'mac_algs': None,
                    'compression_algs': None,
                }
                
                conn = await asyncssh.connect(**options)
                
                logger.info(f"✅ Connected to {host}:{port} with method 2")
                
                self.connections[session_id] = conn
                self.sessions[session_id] = {
                    'host': host,
                    'port': port,
                    'username': username,
                    'connected': True
                }
                
                return True
                
        except asyncssh.Error as e:
            error_msg = str(e)
            logger.error(f"❌ SSH connection failed: {error_msg}")
            
            # Log error yang lebih informatif
            if "Host key" in error_msg:
                logger.error("Host key verification failed - pastikan known_hosts=None")
            elif "authentication" in error_msg.lower():
                logger.error("Authentication failed - cek username/password")
            elif "Connection refused" in error_msg:
                logger.error("Connection refused - cek host/port dan firewall")
            elif "Timeout" in error_msg:
                logger.error("Timeout - server tidak merespon")
            
            return False
            
        except Exception as e:
            logger.error(f"❌ Unexpected error: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    async def execute_command(self, session_id: str, command: str) -> str:
        if session_id not in self.connections:
            return "Not connected to any server"
        
        try:
            conn = self.connections[session_id]
            result = await conn.run(command, check=False)
            return result.stdout + result.stderr
        except Exception as e:
            logger.error(f"Command execution failed: {str(e)}")
            return f"Error: {str(e)}"
    
    async def create_shell(self, session_id: str, websocket):
        """Buat interactive shell untuk WebSocket"""
        
        if session_id not in self.connections:
            await websocket.send_json({
                "type": "error", 
                "data": "Session not found"
            })
            return
        
        conn = self.connections[session_id]
        session_info = self.sessions.get(session_id, {})
        
        try:
            # Buat shell
            process = await conn.create_process(
                term_type='xterm-256color',
                env={'TERM': 'xterm-256color'}
            )
            
            logger.info(f"Shell created for session {session_id}")
            
            # Kirim welcome message
            await websocket.send_json({
                "type": "data",
                "data": f"\r\n\u001b[1;32mConnected to {session_info.get('host', 'unknown')}\u001b[0m\r\n"
            })
            
            # 🔥 PENTING: Tangkap prompt awal
            initial_data = ""
            try:
                # Baca data awal selama 1 detik
                for _ in range(10):  # Coba 10 kali
                    try:
                        data = await asyncio.wait_for(process.stdout.__anext__(), timeout=0.1)
                        initial_data += data
                        logger.info(f"📥 Initial data: {repr(data)}")
                    except asyncio.TimeoutError:
                        break  # Tidak ada data lagi
                    except StopAsyncIteration:
                        break
            except Exception as e:
                logger.error(f"Error reading initial data: {e}")
            
            # Kirim semua data awal termasuk prompt
            if initial_data:
                await websocket.send_json({
                    "type": "data",
                    "data": initial_data
                })
            
            # Task untuk baca dari process selanjutnya
            async def read_task():
                try:
                    async for data in process.stdout:
                        if data:
                            logger.info(f"📤 Sending from server: {repr(data)}")
                            await websocket.send_json({
                                "type": "data",
                                "data": data
                            })
                except Exception as e:
                    logger.error(f"Read error: {e}")
            
            # Task untuk baca dari websocket
            async def write_task():
                try:
                    async for message in websocket.iter_json():
                        if message['type'] == 'input':
                            input_data = message['data']
                            logger.debug(f"➡️ To server: {input_data[:30]}")
                            process.stdin.write(input_data)
                            
                        elif message['type'] == 'resize':
                            cols = message.get('cols')
                            rows = message.get('rows')
                            if cols and rows:
                                process.change_terminal_size(
                                    max(10, int(cols)),
                                    max(10, int(rows))
                                )
                except Exception as e:
                    logger.error(f"Write error: {e}")
            
            # Jalankan kedua task
            await asyncio.gather(read_task(), write_task())
            
        except Exception as e:
            logger.error(f"Shell error: {e}")
            await websocket.send_json({
                "type": "error",
                "data": f"Shell error: {str(e)}"
            })
        finally:
            if 'process' in locals():
                process.close()
                await process.wait_closed()
    
    def disconnect(self, session_id: str):
        if session_id in self.connections:
            try:
                self.connections[session_id].close()
                asyncio.create_task(self.connections[session_id].wait_closed())
            except:
                pass
            finally:
                del self.connections[session_id]
                if session_id in self.sessions:
                    self.sessions[session_id]['connected'] = False
                logger.info(f"Disconnected session {session_id}")
    
    def get_session_status(self, session_id: str) -> Dict:
        return self.sessions.get(session_id, {'connected': False})
    
    def get_all_sessions(self) -> Dict:
        return self.sessions

# Singleton instance
ssh_manager = SSHManager()