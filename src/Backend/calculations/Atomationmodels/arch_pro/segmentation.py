import os
import sys
import numpy as np
import cv2
from typing import List, Dict, Tuple
from pathlib import Path
from ultralytics import YOLO

# Add local path to find utilities
sys.path.append(str(Path(__file__).parent))
from opencv_utils import clean_noisy_mask

class ArchSegmentation:
    def __init__(self, model_path: str, yolo_path: str):
        """Lightweight segmentation using YOLO and OpenCV (No Furukawa)."""
        # Load YOLO - this is fast and handles structural/furniture elements
        self.yolo = YOLO(yolo_path)
        # Force CPU if needed, but YOLO on CPU is usually fine
        # self.yolo.to('cpu') 

    def segment(self, img_path: str, ppm: float = 100.0, gap_closer=None) -> Dict:
        """Process floorplan image using the 'Spine-to-Centerline' Master Engine."""
        print(f"DEBUG: Arch Pro 5.0 SPINE Segmentation triggered for {img_path}")
        img = cv2.imread(img_path)
        if img is None: return {"walls": [], "doors": [], "windows": [], "rooms": []}
        
        h, w = img.shape[:2]
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # 1. YOLO Detection
        yolo_res = self.yolo(img_rgb, verbose=False)[0]
        
        # 2. PRE-CLEANING (Edge-Preserving)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        denoised = cv2.bilateralFilter(gray, 9, 75, 75)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(denoised)
        
        # 3. SOLID STRUCTURAL MASK
        ret, thresh = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        kernel_cl = np.ones((5,5), np.uint8)
        # Bridge gaps and solidify walls
        solid_walls = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel_cl, iterations=2)
        solid_walls = cv2.morphologyEx(solid_walls, cv2.MORPH_OPEN, np.ones((3,3), np.uint8), iterations=1)
        
        # YOLO Boosting (rescue walls)
        if yolo_res.boxes is not None:
            for box, cid in zip(yolo_res.boxes.xyxy.cpu().numpy(), yolo_res.boxes.cls.cpu().numpy().astype(int)):
                if "wall" in self.yolo.names[cid].lower():
                    x1, y1, x2, y2 = map(int, box)
                    cv2.rectangle(solid_walls, (x1, y1), (x2, y2), 255, -1)

        # 4. CONTOUR-TO-CENTERLINE (The Spine Logic)
        results = {"walls": [], "doors": [], "windows": [], "rooms": [], "wall_segments": []}
        contours, _ = cv2.findContours(solid_walls, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        raw_segments = []
        for cnt in contours:
            # Engineer Heuristic: Area and Aspect Ratio
            area = cv2.contourArea(cnt)
            if area < 200: continue # Kill small noise
            
            rect = cv2.minAreaRect(cnt)
            (cx, cy), (rw, rh), angle = rect
            
            # Ensure rw is the length
            if rw < rh:
                rw, rh = rh, rw
                angle += 90
            
            # Aspect Ratio Filter: Walls are typically at least 4x longer than thick
            if rw < 3 * rh and area < 500: continue # Reject square-ish noise unless very large
            
            # Extract Centerline based on long axis of minAreaRect
            angle_rad = np.deg2rad(angle)
            vx, vy = np.cos(angle_rad), np.sin(angle_rad)
            
            # Start and End points of the Spine
            s_px = [cx - (rw/2)*vx, cy - (rw/2)*vy]
            e_px = [cx + (rw/2)*vx, cy + (rw/2)*vy]
            
            # Map to meters
            sx, sy, ex, ey = s_px[0]/ppm, s_px[1]/ppm, e_px[0]/ppm, e_px[1]/ppm
            length = np.sqrt((sx-ex)**2 + (sy-ey)**2)
            
            if length > 0.3:
                raw_segments.append({"start": [sx, sy], "end": [ex, ey], "length": length, "thickness": rh/ppm})

        # 5. COLLINEAR STITCHING: Master Weaver for clean models
        merged_segments = self._stitch_collinear(raw_segments)
        for seg in merged_segments:
            results["wall_segments"].append({
                "start": seg["start"], "end": seg["end"],
                "thickness": 0.15, "length": seg["length"]
            })
            # Generate thick polygon for 3D extrusion
            results["walls"].append({"polygon": self._seg_to_poly(seg)})

        # 6. ROOM DETECTION (Uses SOLID walls for structural closure)
        inverted = cv2.bitwise_not(solid_walls)
        if gap_closer: inverted = gap_closer(inverted)
        
        cnts, hierarchy = cv2.findContours(inverted, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        if hierarchy is not None:
            hierarchy = hierarchy[0]
            for i, cnt in enumerate(cnts):
                if hierarchy[i][3] != -1: # Interior void
                    area_m2 = cv2.contourArea(cnt) / (ppm * ppm)
                    if area_m2 > 1.5:
                        eps = 0.01 * cv2.arcLength(cnt, True)
                        approx_room = cv2.approxPolyDP(cnt, eps, True)
                        room_poly = [[float(pt[0][0])/ppm, float(pt[0][1])/ppm] for pt in approx_room]
                        results["rooms"].append({"polygon": room_poly})

        # 7. YOLO OPENINGS
        if yolo_res.boxes is not None:
            for box, cid in zip(yolo_res.boxes.xyxy.cpu().numpy(), yolo_res.boxes.cls.cpu().numpy().astype(int)):
                name = self.yolo.names[cid].lower()
                if "door" in name or "window" in name:
                    poly = [[float(box[0])/ppm, float(box[1])/ppm], [float(box[2])/ppm, float(box[1])/ppm], 
                            [float(box[2])/ppm, float(box[3])/ppm], [float(box[0])/ppm, float(box[1])/ppm]]
                    if "door" in name: results["doors"].append({"polygon": poly})
                    else: results["windows"].append({"polygon": poly})
            
        return results

    def _stitch_collinear(self, segments: List[Dict], dist_thresh=0.3, angle_thresh=0.98) -> List[Dict]:
        """Stitch together segments that are part of the same long architectural wall."""
        if not segments: return []
        stitched = []
        used = [False] * len(segments)
        
        # Sort by length to use major walls as anchors
        segments.sort(key=lambda x: x["length"], reverse=True)
        
        for i in range(len(segments)):
            if used[i]: continue
            s1 = segments[i]
            cur_start = np.array(s1["start"])
            cur_end = np.array(s1["end"])
            used[i] = True
            
            while True:
                found = False
                for j in range(len(segments)):
                    if used[j]: continue
                    s2 = segments[j]
                    p1, p2 = np.array(s2["start"]), np.array(s2["end"])
                    
                    # Check collinearity
                    v1 = cur_end - cur_start
                    v1_n = v1 / (np.linalg.norm(v1) + 1e-6)
                    v2 = p2 - p1
                    v2_n = v2 / (np.linalg.norm(v2) + 1e-6)
                    
                    if np.abs(np.dot(v1_n, v2_n)) > angle_thresh:
                        # Check endpoint proximity
                        endpoints = [p1, p2]
                        for ep in endpoints:
                            # Distance from endpoint to the current line segment
                            d_start = np.linalg.norm(ep - cur_start)
                            d_end = np.linalg.norm(ep - cur_end)
                            
                            if d_start < dist_thresh or d_end < dist_thresh:
                                # Update current line to span both
                                all_pts = np.array([cur_start, cur_end, p1, p2])
                                # Simple min/max along direction vector
                                dots = np.dot(all_pts, v1_n)
                                cur_start = all_pts[np.argmin(dots)]
                                cur_end = all_pts[np.argmax(dots)]
                                used[j] = True
                                found = True
                                break
                    if found: break
                if not found: break
                
            new_len = np.linalg.norm(cur_end - cur_start)
            stitched.append({"start": cur_start.tolist(), "end": cur_end.tolist(), "length": new_len})
            
        return stitched

    def _seg_to_poly(self, seg):
        s, e = np.array(seg["start"]), np.array(seg["end"])
        v = e - s
        if np.linalg.norm(v) < 1e-6: return []
        perp = np.array([-v[1], v[0]])
        perp = (perp / np.linalg.norm(perp)) * 0.075 # 0.15m total thick
        return [
            (s - perp).tolist(), (s + perp).tolist(),
            (e + perp).tolist(), (e - perp).tolist()
        ]

