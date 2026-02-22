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
    
    # ==================== LOCAL TERMINAL (IMPROVED) ====================
    async def create_local_shell(self, session_id: str) -> bool:
        """Buat shell lokal dengan deteksi OS"""
        try:
            logger.info(f"Creating local shell for session {session_id}")
            
            system = platform.system()
            logger.info(f"Detected OS: {system}")
            
            if system == "Windows":
                return await self._create_windows_local_shell(session_id)
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
    
    async def _create_windows_local_shell(self, session_id: str) -> bool:
        """Buat local shell di Windows dengan PowerShell"""
        try:
            # Buat queue untuk komunikasi
            output_queue = queue.Queue()
            input_queue = queue.Queue()
            running = threading.Event()
            running.set()
            
            def shell_thread():
                try:
                    # PowerShell dengan prompt yang lebih baik
                    process = subprocess.Popen(
                        [
                            "powershell.exe",
                            "-NoLogo",
                            "-NoExit",
                            "-Command",
                            "function prompt { 'PS ' + (Get-Location).Path + '> ' }; Set-Location ~; $Host.UI.RawUI.ForegroundColor = 'Green'"
                        ],
                        stdin=subprocess.PIPE,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                        bufsize=1,
                        universal_newlines=True,
                        creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0
                    )
                    
                    logger.info(f"PowerShell process started with PID: {process.pid}")
                    
                    # Simpan process di local_sessions
                    self.local_sessions[session_id] = {
                        'process': process,
                        'input_queue': input_queue,
                        'output_queue': output_queue,
                        'running': running
                    }
                    
                    # Thread untuk baca output
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
                    
                    # Thread untuk tulis input
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
                    
                    # Tunggu process selesai
                    process.wait()
                    
                except Exception as e:
                    logger.error(f"Shell thread error: {e}")
                finally:
                    running.clear()
                    logger.info(f"Shell thread ended for session {session_id}")
                
                return True
            
            # Jalankan thread
            thread = threading.Thread(target=shell_thread, daemon=True)
            thread.start()
            
            # Tunggu sebentar untuk memastikan process berjalan
            await asyncio.sleep(1)
            
            self.sessions[session_id] = {
                'host': 'localhost',
                'port': 0,
                'username': os.environ.get('USERNAME', 'user'),
                'connected': True,
                'type': 'local',
                'platform': 'Windows',
                'shell': 'PowerShell'
            }
            
            logger.info(f"✅ Windows local shell created for session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to create Windows local shell: {e}", exc_info=True)
            return False
    
    async def _create_linux_local_shell(self, session_id: str) -> bool:
        """Buat local shell di Linux dengan bash"""
        try:
            # Cek shell yang tersedia
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
            
            logger.info(f"Shell process started with PID: {process.pid}")
            
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
    
    async def _create_mac_local_shell(self, session_id: str) -> bool:
        """Buat local shell di macOS dengan zsh"""
        try:
            # Cek shell yang tersedia (zsh default di macOS)
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
            
            logger.info(f"Shell process started with PID: {process.pid}")
            
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
    
    async def handle_local_shell(self, session_id: str, websocket):
        """Handle local shell session - mirip dengan SSH"""
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
        await websocket.send_json({
            "type": "data",
            "data": f"\r\n\u001b[1;32m🔌 Local Terminal ({platform_name} - {shell_name})\u001b[0m\r\n"
        })
        await websocket.send_json({
            "type": "data",
            "data": f"\u001b[1;34m📡 Connected to {platform.node()}\u001b[0m\r\n\r\n"
        })
        
        if session.get('type') == 'asyncio':
            # Untuk Linux/macOS (asyncio subprocess)
            process = session['process']
            
            # Baca output awal (prompt)
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
                            
                            # 🔥 KIRIM KE SHELL (WAJIB!)
                            input_queue.put(input_data)
                            
                            # Echo lokal hanya untuk tampilan
                            if input_data == '\r' or input_data == '\n':
                                # Enter
                                await websocket.send_json({
                                    "type": "data",
                                    "data": '\r\n'
                                })
                            elif input_data == '\b' or input_data == '\x7f':
                                # Backspace - tampilan saja
                                await websocket.send_json({
                                    "type": "data",
                                    "data": '\b \b'
                                })
                            elif input_data.isprintable() or input_data in ['\t', '\x1b']:
                                # Karakter biasa
                                await websocket.send_json({
                                    "type": "data",
                                    "data": input_data
                                })
                except Exception as e:
                    logger.error(f"Write task error: {e}")
            
            await asyncio.gather(read_task(), write_task())
            
        else:
            # Untuk Windows (threading + queue)
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
                            # Bersihkan output untuk rendering yang lebih baik
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
                            input_data = message['data']
                            
                            # 🔥 KIRIM KE SHELL (WAJIB!)
                            input_queue.put(input_data)
                            
                            # Echo lokal hanya untuk tampilan
                            if input_data == '\r' or input_data == '\n':
                                # Enter
                                await websocket.send_json({
                                    "type": "data",
                                    "data": '\r\n'
                                })
                            elif input_data == '\b' or input_data == '\x7f':
                                # Backspace - tampilan saja
                                await websocket.send_json({
                                    "type": "data",
                                    "data": '\b \b'
                                })
                            elif input_data.isprintable() or input_data in ['\t', '\x1b']:
                                # Karakter biasa
                                await websocket.send_json({
                                    "type": "data",
                                    "data": input_data
                                })
                except Exception as e:
                    logger.error(f"Write task error: {e}")
            
            await asyncio.gather(read_task(), write_task())
            running.clear()
        
        # Cleanup
        if session_id in self.local_sessions:
            if session.get('type') == 'asyncio':
                process = session['process']
                if process.returncode is None:
                    process.terminate()
                    try:
                        await asyncio.wait_for(process.wait(), timeout=2.0)
                    except asyncio.TimeoutError:
                        process.kill()
            else:
                process = session.get('process')
                if process:
                    process.terminate()
            del self.local_sessions[session_id]
    # ============================================================
    
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

            # Hanya satu welcome message
            # await websocket.send_json({
            #     "type": "data",
            #     "data": f"\r\n\u001b[1;32mConnected to {session_info.get('host', 'unknown')}\u001b[0m\r\n"
            # })

            async def read_task():
                async for data in process.stdout:
                    if data:
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
                if session.get('type') == 'asyncio':
                    process = session['process']
                    if process.returncode is None:
                        process.terminate()
                else:
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