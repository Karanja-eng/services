# ============================================================================
# FILE: backend/gnss/ntrip/client.py
# ============================================================================
"""
NTRIP (Networked Transport of RTCM via Internet Protocol) client.
Streams real-time GNSS corrections from NTRIP casters.
"""

import socket
import base64
from typing import Optional, Callable
from dataclasses import dataclass
import threading
from .schemas import StationCoordinate

@dataclass
class NTRIPConfig:
    """NTRIP connection configuration."""
    host: str
    port: int
    mountpoint: str
    username: str
    password: str
    user_agent: str = "NTRIP Python Client/1.0"

class NTRIPClient:
    """
    NTRIP client for receiving real-time RTCM corrections.
    """
    
    def __init__(self, config: NTRIPConfig):
        self.config = config
        self.socket: Optional[socket.socket] = None
        self.connected = False
        self.streaming = False
        self.stream_thread: Optional[threading.Thread] = None
    
    def connect(self) -> bool:
        """
        Connect to NTRIP caster and request mountpoint.
        """
        try:
            # Create socket
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(10.0)
            
            # Connect to caster
            self.socket.connect((self.config.host, self.config.port))
            
            # Build HTTP request
            auth_string = f"{self.config.username}:{self.config.password}"
            auth_encoded = base64.b64encode(auth_string.encode()).decode()
            
            request = (
                f"GET /{self.config.mountpoint} HTTP/1.1\r\n"
                f"Host: {self.config.host}\r\n"
                f"User-Agent: {self.config.user_agent}\r\n"
                f"Authorization: Basic {auth_encoded}\r\n"
                "Connection: close\r\n"
                "\r\n"
            )
            
            # Send request
            self.socket.sendall(request.encode())
            
            # Read response
            response = self.socket.recv(1024).decode()
            
            if "200 OK" in response or "ICY 200" in response:
                self.connected = True
                return True
            else:
                self.disconnect()
                return False
        
        except Exception as e:
            print(f"NTRIP connection failed: {e}")
            self.disconnect()
            return False
    
    def start_stream(self, callback: Callable[[bytes], None]):
        """
        Start streaming RTCM data in background thread.
        """
        if not self.connected:
            raise RuntimeError("Not connected to NTRIP caster")
        
        self.streaming = True
        self.stream_thread = threading.Thread(
            target=self._stream_worker,
            args=(callback,),
            daemon=True
        )
        self.stream_thread.start()
    
    def _stream_worker(self, callback: Callable[[bytes], None]):
        """Worker thread for receiving RTCM stream."""
        buffer = b""
        
        while self.streaming and self.connected:
            try:
                # Receive data
                data = self.socket.recv(4096)
                if not data:
                    break
                
                buffer += data
                
                # Process RTCM messages
                while len(buffer) >= 3:
                    # RTCM message starts with 0xD3
                    if buffer[0] != 0xD3:
                        buffer = buffer[1:]
                        continue
                    
                    # Get message length
                    msg_len = ((buffer[1] & 0x03) << 8) | buffer[2]
                    total_len = msg_len + 6  # Header (3) + payload + CRC (3)
                    
                    if len(buffer) < total_len:
                        break  # Wait for complete message
                    
                    # Extract message
                    message = buffer[:total_len]
                    buffer = buffer[total_len:]
                    
                    # Call user callback
                    callback(message)
            
            except socket.timeout:
                continue
            except Exception as e:
                print(f"NTRIP stream error: {e}")
                break
        
        self.streaming = False
    
    def stop_stream(self):
        """Stop streaming RTCM data."""
        self.streaming = False
        if self.stream_thread:
            self.stream_thread.join(timeout=5.0)
    
    def disconnect(self):
        """Disconnect from NTRIP caster."""
        self.stop_stream()
        if self.socket:
            try:
                self.socket.close()
            except:
                pass
        self.connected = False
        self.socket = None
    
    def send_gga(self, gga_sentence: str):
        """
        Send NMEA GGA sentence to caster (for VRS/network RTK).
        """
        if not self.connected:
            raise RuntimeError("Not connected to NTRIP caster")
        
        try:
            self.socket.sendall((gga_sentence + "\r\n").encode())
        except Exception as e:
            print(f"Failed to send GGA: {e}")
