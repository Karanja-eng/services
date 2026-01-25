# ============================================================================
# FILE: backend/gnss/rinex/parser.py
# ============================================================================
"""
RINEX (Receiver Independent Exchange Format) file parser.
Supports RINEX 2.x and 3.x observation files.
"""

import re
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass

@dataclass
class RINEXHeader:
    """RINEX file header information."""
    version: float
    file_type: str
    marker_name: str
    receiver_type: str
    antenna_type: str
    approx_position: tuple  # (X, Y, Z) in meters
    antenna_delta: tuple    # (dH, dE, dN) in meters
    observation_types: List[str]
    interval: float  # seconds
    first_obs: datetime
    last_obs: Optional[datetime] = None

@dataclass
class RINEXEpoch:
    """Single epoch of RINEX observations."""
    timestamp: datetime
    satellites: Dict[str, Dict[str, float]]  # sat_id -> {obs_type -> value}
    flag: int = 0  # Epoch flag (0=OK, 1=power failure, etc.)

class RINEXParser:
    """
    Parser for RINEX observation files.
    """
    
    def __init__(self, filepath: str):
        self.filepath = filepath
        self.header: Optional[RINEXHeader] = None
        self.epochs: List[RINEXEpoch] = []
    
    def parse(self) -> Dict:
        """Parse RINEX file and extract all data."""
        with open(self.filepath, 'r') as f:
            lines = f.readlines()
        
        # Parse header
        header_end = self._parse_header(lines)
        
        # Parse observations
        self._parse_observations(lines[header_end:])
        
        return {
            "header": self.header,
            "epochs": self.epochs,
            "num_epochs": len(self.epochs),
            "duration_seconds": (self.epochs[-1].timestamp - self.epochs[0].timestamp).total_seconds() if self.epochs else 0
        }
    
    def _parse_header(self, lines: List[str]) -> int:
        """Parse RINEX header section."""
        header_data = {}
        obs_types = []
        
        for i, line in enumerate(lines):
            if "END OF HEADER" in line:
                # Construct header object
                self.header = RINEXHeader(
                    version=header_data.get('version', 2.0),
                    file_type=header_data.get('file_type', 'O'),
                    marker_name=header_data.get('marker', 'UNKNOWN'),
                    receiver_type=header_data.get('receiver', 'UNKNOWN'),
                    antenna_type=header_data.get('antenna', 'UNKNOWN'),
                    approx_position=header_data.get('position', (0, 0, 0)),
                    antenna_delta=header_data.get('delta', (0, 0, 0)),
                    observation_types=obs_types,
                    interval=header_data.get('interval', 30.0),
                    first_obs=header_data.get('first_obs', datetime.now())
                )
                return i + 1
            
            # Parse specific header lines
            if "RINEX VERSION" in line:
                header_data['version'] = float(line[:9].strip())
                header_data['file_type'] = line[20].strip()
            
            elif "MARKER NAME" in line:
                header_data['marker'] = line[:60].strip()
            
            elif "REC # / TYPE / VERS" in line:
                header_data['receiver'] = line[20:40].strip()
            
            elif "ANT # / TYPE" in line:
                header_data['antenna'] = line[20:40].strip()
            
            elif "APPROX POSITION XYZ" in line:
                coords = line[:60].split()
                header_data['position'] = tuple(float(c) for c in coords[:3])
            
            elif "ANTENNA: DELTA H/E/N" in line:
                deltas = line[:60].split()
                header_data['delta'] = tuple(float(d) for d in deltas[:3])
            
            elif "# / TYPES OF OBSERV" in line or "SYS / # / OBS TYPES" in line:
                # Extract observation types
                parts = line[:60].split()
                obs_types.extend(parts[1:])
            
            elif "INTERVAL" in line:
                header_data['interval'] = float(line[:10].strip())
            
            elif "TIME OF FIRST OBS" in line:
                # Parse datetime
                parts = line[:60].split()
                header_data['first_obs'] = datetime(
                    int(parts[0]), int(parts[1]), int(parts[2]),
                    int(parts[3]), int(parts[4]), int(float(parts[5]))
                )
        
        return len(lines)
    
    def _parse_observations(self, lines: List[str]):
        """Parse observation data section."""
        i = 0
        while i < len(lines):
            line = lines[i]
            
            # Check for epoch header (starts with ' ' or '>' for RINEX 3)
            if line.startswith(' ') or line.startswith('>'):
                epoch = self._parse_epoch(lines, i)
                if epoch:
                    self.epochs.append(epoch)
                    i += 1 + len(epoch.satellites)  # Skip satellite obs lines
                else:
                    i += 1
            else:
                i += 1
    
    def _parse_epoch(self, lines: List[str], start_idx: int) -> Optional[RINEXEpoch]:
        """Parse single epoch of observations."""
        line = lines[start_idx]
        
        try:
            # Parse timestamp (RINEX 2.x format)
            year = int(line[1:3])
            year = 2000 + year if year < 80 else 1900 + year
            month = int(line[4:6])
            day = int(line[7:9])
            hour = int(line[10:12])
            minute = int(line[13:15])
            second = float(line[16:26])
            
            timestamp = datetime(year, month, day, hour, minute, int(second))
            
            # Number of satellites
            flag = int(line[28])
            num_sats = int(line[30:32])
            
            # Satellite IDs
            sat_ids = []
            pos = 32
            for _ in range(num_sats):
                if pos + 3 <= len(line):
                    sat_ids.append(line[pos:pos+3].strip())
                    pos += 3
            
            # Parse observations for each satellite
            satellites = {}
            for j, sat_id in enumerate(sat_ids):
                if start_idx + 1 + j >= len(lines):
                    break
                obs_line = lines[start_idx + 1 + j]
                
                # Parse observation values
                obs_data = {}
                for k, obs_type in enumerate(self.header.observation_types[:5]):  # First 5 obs per line
                    start = k * 16
                    if start + 14 <= len(obs_line):
                        value_str = obs_line[start:start+14].strip()
                        if value_str:
                            obs_data[obs_type] = float(value_str)
                
                satellites[sat_id] = obs_data
            
            return RINEXEpoch(timestamp=timestamp, satellites=satellites, flag=flag)
        
        except (ValueError, IndexError):
            return None
