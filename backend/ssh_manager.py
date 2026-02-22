import asyncio
import asyncssh
import subprocess
import platform
from typing import Dict, Optional
import logging
import asyncio.subprocess as asp
import os
import threading
import queue
import signal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== PYWINPTY IMPORT ====================
try:
    from winpty import PtyProcess
    WINPTY_AVAILABLE = True
except ImportError:
    WINPTY_AVAILABLE = False
    logger.warning("pywinpty not installed. Windows local terminal will not work.")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SSHManager:
    def __init__(self):
        self.connections: Dict[str, asyncssh.SSHClientConnection] = {}
        self.local_sessions: Dict[str, Dict] = {}
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
                    known_hosts=None,
                    connect_timeout=30,
                    keepalive_interval=15,
                    keepalive_count_max=3,
                )
                
                logger.info(f"✅ Connected to {host}:{port}")
                
                self.connections[session_id] = conn
                self.sessions[session_id] = {
                    'host': host,
                    'port': port,
                    'username': username,
                    'connected': True,
                    'type': 'ssh'
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
                    'keepalive_count_max': 3,
                    'kex_algs': None,
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
                    'connected': True,
                    'type': 'ssh'
                }
                
                return True
                
        except asyncssh.Error as e:
            error_msg = str(e)
            logger.error(f"❌ SSH connection failed: {error_msg}")
            
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
    
    # ==================== LOCAL TERMINAL DENGAN PYWINPTY ====================
    async def create_local_shell(self, session_id: str) -> bool:
        """Buat shell lokal dengan deteksi OS"""
        try:
            logger.info(f"Creating local shell for session {session_id}")
            
            system = platform.system()
            logger.info(f"Detected OS: {system}")
            
            if system == "Windows":
                if not WINPTY_AVAILABLE:
                    logger.error("pywinpty not installed. Please run: pip install pywinpty")
                    return False
                return await self._create_windows_local_shell_pywinpty(session_id)
            elif system == "Linux":
                return await self._create_linux_local_shell(session_id)
            elif system == "Darwin":
                return await self._create_mac_local_shell(session_id)
            else:
                logger.error(f"Unsupported OS: {system}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Failed to create local shell: {e}", exc_info=True)
            return False
    
    # ==================== WINDOWS DENGAN PYWINPTY ====================
    async def _create_windows_local_shell_pywinpty(self, session_id: str) -> bool:
        """Buat local shell di Windows dengan pywinpty (ConPTY)"""
        try:
            # Spawn PowerShell dengan opsi minimal
            proc = PtyProcess.spawn('powershell.exe')
            
            logger.info(f"✅ Pywinpty PowerShell process started")
            
            # Jangan kirim perintah langsung, biarkan PowerShell menampilkan prompt default
            
            self.local_sessions[session_id] = {
                'process': proc,
                'type': 'winpty'
            }
            
            self.sessions[session_id] = {
                'host': 'localhost',
                'port': 0,
                'username': os.environ.get('USERNAME', 'user'),
                'connected': True,
                'type': 'local',
                'platform': 'Windows',
                'shell': 'PowerShell (ConPTY)'
            }
            
            logger.info(f"✅ Windows local shell (pywinpty) created for session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to create Windows pywinpty shell: {e}", exc_info=True)
        return False
    
    # ==================== WINDOWS LEGACY (fallback) ====================
    async def _create_windows_local_shell_legacy(self, session_id: str) -> bool:
        """Buat local shell di Windows dengan threading (legacy fallback)"""
        try:
            # Buat queue untuk komunikasi
            output_queue = queue.Queue()
            input_queue = queue.Queue()
            running = threading.Event()
            running.set()
            
            def shell_thread():
                try:
                    process = subprocess.Popen(
                        [
                            "powershell.exe",
                            "-NoLogo",
                            "-NoExit",
                            "-Command",
                            "function prompt { 'PS ' + (Get-Location).Path + '> ' }; Set-Location ~"
                        ],
                        stdin=subprocess.PIPE,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                        bufsize=1,
                        universal_newlines=True,
                        creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0
                    )
                    
                    logger.info(f"Legacy PowerShell process started with PID: {process.pid}")
                    
                    self.local_sessions[session_id] = {
                        'process': process,
                        'input_queue': input_queue,
                        'output_queue': output_queue,
                        'running': running,
                        'type': 'winpty_fallback'
                    }
                    
                    def read_output():
                        while running.is_set():
                            try:
                                line = process.stdout.readline()
                                if line:
                                    output_queue.put(line)
                                else:
                                    break
                            except:
                                break
                    
                    reader = threading.Thread(target=read_output, daemon=True)
                    reader.start()
                    
                    def write_input():
                        while running.is_set():
                            try:
                                cmd = input_queue.get(timeout=0.1)
                                if cmd is None:
                                    break
                                process.stdin.write(cmd)
                                process.stdin.flush()
                            except queue.Empty:
                                continue
                            except:
                                break
                    
                    writer = threading.Thread(target=write_input, daemon=True)
                    writer.start()
                    
                    process.wait()
                    
                except Exception as e:
                    logger.error(f"Legacy shell thread error: {e}")
                finally:
                    running.clear()
                
                return True
            
            thread = threading.Thread(target=shell_thread, daemon=True)
            thread.start()
            
            await asyncio.sleep(1)
            
            self.sessions[session_id] = {
                'host': 'localhost',
                'port': 0,
                'username': os.environ.get('USERNAME', 'user'),
                'connected': True,
                'type': 'local',
                'platform': 'Windows',
                'shell': 'PowerShell (Legacy)'
            }
            
            logger.info(f"✅ Windows legacy shell created for session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to create Windows legacy shell: {e}", exc_info=True)
            return False
    
    # ==================== LINUX LOCAL SHELL ====================
    async def _create_linux_local_shell(self, session_id: str) -> bool:
        """Buat local shell di Linux dengan bash"""
        try:
            shells = ['/bin/bash', '/bin/sh']
            shell_cmd = None
            
            for shell in shells:
                if os.path.exists(shell):
                    shell_cmd = [shell, '--login']
                    break
            
            if not shell_cmd:
                logger.error("No suitable shell found")
                return False
            
            process = await asyncio.create_subprocess_exec(
                *shell_cmd,
                stdin=asp.PIPE,
                stdout=asp.PIPE,
                stderr=asp.STDOUT,
                env={
                    "TERM": "xterm-256color",
                    "LANG": "en_US.UTF-8",
                    "PATH": os.environ.get("PATH", ""),
                    "HOME": os.environ.get("HOME", ""),
                    "USER": os.environ.get("USER", "user"),
                }
            )
            
            logger.info(f"Linux shell process started with PID: {process.pid}")
            
            self.local_sessions[session_id] = {
                'process': process,
                'type': 'asyncio'
            }
            
            self.sessions[session_id] = {
                'host': 'localhost',
                'port': 0,
                'username': os.environ.get('USER', 'user'),
                'connected': True,
                'type': 'local',
                'platform': 'Linux',
                'shell': 'bash'
            }
            
            logger.info(f"✅ Linux local shell created for session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to create Linux local shell: {e}", exc_info=True)
            return False
    
    # ==================== MACOS LOCAL SHELL ====================
    async def _create_mac_local_shell(self, session_id: str) -> bool:
        """Buat local shell di macOS dengan zsh"""
        try:
            shells = ['/bin/zsh', '/bin/bash']
            shell_cmd = None
            
            for shell in shells:
                if os.path.exists(shell):
                    shell_cmd = [shell, '--login']
                    break
            
            if not shell_cmd:
                logger.error("No suitable shell found")
                return False
            
            process = await asyncio.create_subprocess_exec(
                *shell_cmd,
                stdin=asp.PIPE,
                stdout=asp.PIPE,
                stderr=asp.STDOUT,
                env={
                    "TERM": "xterm-256color",
                    "LANG": "en_US.UTF-8",
                    "PATH": os.environ.get("PATH", ""),
                    "HOME": os.environ.get("HOME", ""),
                    "USER": os.environ.get("USER", "user"),
                }
            )
            
            logger.info(f"macOS shell process started with PID: {process.pid}")
            
            self.local_sessions[session_id] = {
                'process': process,
                'type': 'asyncio'
            }
            
            self.sessions[session_id] = {
                'host': 'localhost',
                'port': 0,
                'username': os.environ.get('USER', 'user'),
                'connected': True,
                'type': 'local',
                'platform': 'macOS',
                'shell': 'zsh'
            }
            
            logger.info(f"✅ macOS local shell created for session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to create macOS local shell: {e}", exc_info=True)
            return False
    
    # ==================== HANDLE LOCAL SHELL ====================
    async def handle_local_shell(self, session_id: str, websocket):
        """Handle local shell session"""
        if session_id not in self.local_sessions:
            await websocket.send_json({
                "type": "error",
                "data": "Local session not found"
            })
            return
        
        session = self.local_sessions[session_id]
        session_info = self.sessions.get(session_id, {})
        platform_name = session_info.get('platform', 'Unknown')
        shell_name = session_info.get('shell', 'Shell')
        
        # Kirim welcome message
        # await websocket.send_json({
        #     "type": "data",
        #     "data": f"\r\n\u001b[1;32m🔌 Local Terminal ({platform_name} - {shell_name})\u001b[0m\r\n"
        # })
        # await websocket.send_json({
        #     "type": "data",
        #     "data": f"\u001b[1;34m📡 Connected to {platform.node()}\u001b[0m\r\n\r\n"
        # })
        
        # ==================== PYWINPTY HANDLER ====================
        if session.get('type') == 'winpty':
            proc = session['process']
            
            # Baca output awal
            try:
                await asyncio.sleep(0.5)
                initial_data = proc.read()
                if initial_data:
                    # Bersihkan output agar tidak menggabungkan baris
                    lines = initial_data.split('\n')
                    for i, line in enumerate(lines):
                        if line.strip() or line == '':
                            # Tambahkan newline kecuali baris terakhir yang kosong
                            if i < len(lines) - 1 or (i == len(lines) - 1 and line.strip()):
                                await websocket.send_json({
                                    "type": "data",
                                    "data": line + '\r\n'
                                })
            except:
                pass
            
            async def read_task():
                try:
                    while True:
                        data = await asyncio.get_event_loop().run_in_executor(
                            None, proc.read
                        )
                        if data:
                            # Pastikan setiap baris diakhiri dengan newline yang benar
                            await websocket.send_json({
                                "type": "data",
                                "data": data
                            })
                        else:
                            await asyncio.sleep(0.05)
                except Exception as e:
                    logger.error(f"Read task error: {e}")
            
            async def write_task():
                try:
                    async for message in websocket.iter_json():
                        if message['type'] == 'input':
                            input_data = message['data']
                            
                            # Kirim ke process
                            proc.write(input_data)
                            
                            # Untuk debugging
                            logger.debug(f"Sent to PowerShell: {repr(input_data)}")
                            
                except Exception as e:
                    logger.error(f"Write task error: {e}")
            
            await asyncio.gather(read_task(), write_task())
        
        # ==================== ASYNCIO HANDLER (Linux/macOS) ====================
        elif session.get('type') == 'asyncio':
            process = session['process']
            
            # Baca output awal
            try:
                initial_data = await asyncio.wait_for(process.stdout.read(1024), timeout=0.5)
                if initial_data:
                    await websocket.send_json({
                        "type": "data",
                        "data": initial_data.decode('utf-8', errors='replace')
                    })
            except asyncio.TimeoutError:
                pass
            
            async def read_task():
                try:
                    while True:
                        data = await process.stdout.read(1024)
                        if not data:
                            break
                        await websocket.send_json({
                            "type": "data",
                            "data": data.decode('utf-8', errors='replace')
                        })
                except Exception as e:
                    logger.error(f"Read error: {e}")
            
            async def write_task():
                try:
                    async for message in websocket.iter_json():
                        if message['type'] == 'input':
                            input_data = message['data']
                            process.stdin.write(input_data.encode())
                            await process.stdin.drain()
                except Exception as e:
                    logger.error(f"Write error: {e}")
            
            await asyncio.gather(read_task(), write_task())
        
        # ==================== LEGACY HANDLER (fallback) ====================
        elif session.get('type') == 'winpty_fallback':
            output_queue = session['output_queue']
            input_queue = session['input_queue']
            running = session['running']
            
            async def read_task():
                while running.is_set():
                    try:
                        line = await asyncio.get_event_loop().run_in_executor(
                            None, output_queue.get, True, 0.1
                        )
                        if line:
                            cleaned_line = line.replace('\r\n', '\n').replace('\r', '\n')
                            await websocket.send_json({
                                "type": "data",
                                "data": cleaned_line
                            })
                    except queue.Empty:
                        await asyncio.sleep(0.05)
                    except Exception as e:
                        logger.error(f"Read task error: {e}")
                        break
            
            async def write_task():
                try:
                    async for message in websocket.iter_json():
                        if message['type'] == 'input':
                            input_queue.put(message['data'])
                except Exception as e:
                    logger.error(f"Write task error: {e}")
            
            await asyncio.gather(read_task(), write_task())
            running.clear()
        
        # Cleanup
        if session_id in self.local_sessions:
            try:
                if session.get('type') == 'winpty':
                    session['process'].terminate()
                elif session.get('type') == 'asyncio':
                    process = session['process']
                    if process.returncode is None:
                        process.terminate()
                        try:
                            await asyncio.wait_for(process.wait(), timeout=2.0)
                        except asyncio.TimeoutError:
                            process.kill()
                elif session.get('type') == 'winpty_fallback':
                    process = session.get('process')
                    if process:
                        process.terminate()
            except:
                pass
            finally:
                del self.local_sessions[session_id]
    
    # ==================== SSH METHODS (TIDAK DIUBAH) ====================
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
        """Buat SSH shell - TIDAK DIUBAH"""
        if session_id not in self.connections:
            await websocket.send_json({
                "type": "error",
                "data": "Session not found"
            })
            return

        conn = self.connections[session_id]
        session_info = self.sessions.get(session_id, {})

        try:
            process = await conn.create_process(
                term_type='xterm-256color'
            )

            logger.info(f"SSH Shell created for session {session_id}")

            async def read_task():
                async for data in process.stdout:
                    if data:
                        logger.info(f"📥 RAW from server: {repr(data)}")
                        await websocket.send_json({
                            "type": "data",
                            "data": data
                        })

            async def write_task():
                async for message in websocket.iter_json():
                    if message['type'] == 'input':
                        process.stdin.write(message['data'])

                    elif message['type'] == 'resize':
                        cols = message.get('cols')
                        rows = message.get('rows')
                        if cols and rows:
                            process.change_terminal_size(
                                max(10, int(cols)),
                                max(10, int(rows))
                            )

            await asyncio.gather(read_task(), write_task())

        except Exception as e:
            logger.error(f"SSH Shell error: {e}")
            await websocket.send_json({
                "type": "error",
                "data": f"Shell error: {str(e)}"
            })
        finally:
            if 'process' in locals():
                process.close()
                await process.wait_closed()
    
    def disconnect(self, session_id: str):
        # Cek apakah ini local session
        if session_id in self.local_sessions:
            try:
                session = self.local_sessions[session_id]
                if session.get('type') == 'winpty':
                    session['process'].terminate()
                elif session.get('type') == 'asyncio':
                    process = session['process']
                    if process.returncode is None:
                        process.terminate()
                elif session.get('type') == 'winpty_fallback':
                    process = session.get('process')
                    if process:
                        process.terminate()
                del self.local_sessions[session_id]
                logger.info(f"Local session {session_id} terminated")
            except Exception as e:
                logger.error(f"Error terminating local session: {e}")
        
        # Cek apakah ini SSH session
        if session_id in self.connections:
            try:
                self.connections[session_id].close()
                asyncio.create_task(self.connections[session_id].wait_closed())
                logger.info(f"SSH session {session_id} closed")
            except Exception as e:
                logger.error(f"Error closing SSH session: {e}")
            finally:
                del self.connections[session_id]
        
        # Update session status
        if session_id in self.sessions:
            self.sessions[session_id]['connected'] = False
    
    def get_session_status(self, session_id: str) -> Dict:
        return self.sessions.get(session_id, {'connected': False})
    
    def get_all_sessions(self) -> Dict:
        return self.sessions

# Singleton instance
ssh_manager = SSHManager()