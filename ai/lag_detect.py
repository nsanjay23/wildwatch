# --- Imports ---
import cv2
import time
import firebase_admin
from firebase_admin import credentials, firestore
from ultralytics import YOLO
from flask import Flask, Response
from flask_cors import CORS
import threading
import numpy as np
import os 
import gdown

# --- 1. FILE DOWNLOADER ---
FILE_IDS = {
    "best.pt": "1qMt6JwWXJv5yzbOQb5oH1LwXtnP2vMvv",
    "test_video.mp4": "1DX2pjg2dJXeUSKcgfekhDcwVBpyKPCXn"
}

def download_files_if_missing():
    for filename, file_id in FILE_IDS.items():
        if not os.path.exists(filename):
            print(f"'{filename}' not found. Downloading from Google Drive...")
            try:
                url = f'https://drive.google.com/uc?id={file_id}'
                gdown.download(url, filename, quiet=False)
                print(f"'{filename}' downloaded successfully.")
            except Exception as e:
                print(f"!!! ERROR: Failed to download {filename} from Google Drive.")
                print(f"Make sure File ID '{file_id}' is correct and 'Anyone with the link' is enabled.")
                print(f"Error details: {e}")
                exit()
        else:
            print(f"'{filename}' already exists. Skipping download.")

# --- 2. SETUP ---
download_files_if_missing() 

print("Initializing Firebase...")
cred = credentials.Certificate("serviceAccount.json")
try:
    firebase_admin.initialize_app(cred)
except ValueError:
    pass 
db = firestore.client()
model = YOLO("best.pt") 
print("Firebase and CUSTOM model (best.pt) loaded.")

# --- 3. CAMERA CONFIGURATION ---
CAMERA_SOURCES = {
    "cam_01": 0,                
    "cam_02": "test_video.mp4"
}
PRIORITY_ANIMALS = ["elephant", "tiger", "leopard", "boar", "bear"] 

# (Fetching configs from Firestore...)
CAMERA_ZONES = {}
CAMERA_LOCATIONS = {}
try:
    print("Fetching camera configurations from Firestore...")
    cam_ref = db.collection("cameras").stream()
    for cam in cam_ref:
        cam_id = cam.id
        cam_data = cam.to_dict()
        if cam_id in CAMERA_SOURCES:
            CAMERA_ZONES[cam_id] = cam_data.get("zone", "unknown")
            CAMERA_LOCATIONS[cam_id] = cam_data.get("location", None)
            print(f"- Found config for {cam_id}: Zone {CAMERA_ZONES[cam_id]}")
except Exception as e:
    print(f"!!! Error fetching camera configs: {e}. Using defaults.")

# --- 4. GLOBAL VARIABLES ---
latest_frames = {cam_id: None for cam_id in CAMERA_SOURCES}
last_alert_times = {cam_id: 0 for cam_id in CAMERA_SOURCES}
lock = threading.Lock()

def create_placeholder_frame(text):
    img = np.zeros((480, 640, 3), dtype=np.uint8); img[:] = (30, 30, 30)
    cv2.putText(img, text, (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    (flag, encodedImage) = cv2.imencode(".jpg", img)
    return encodedImage.tobytes()

placeholder_frame = create_placeholder_frame("Connecting...")

# --- 5. AI PROCESSING THREAD (UN-THROTTLED / LAGGY) ---
def process_camera_feed(cam_id, source):
    global latest_frames, last_alert_times
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f"!!! CRITICAL ERROR: Could not open camera source for {cam_id}: {source}")
        return

    while True:
        ret, frame = cap.read()
        if not ret:
            if cam_id == "cam_02": cap.set(cv2.CAP_PROP_POS_FRAMES, 0); continue
            else: cap = cv2.VideoCapture(source); time.sleep(2); continue
        
        try:
            small_frame = cv2.resize(frame, (640, 480))
            current_time = time.time()
            
            # --- NO THROTTLING ---
            # AI runs on EVERY frame. This will be slow and laggy.
            results = model(small_frame, verbose=False)
            
            annotated_frame = small_frame.copy() 
            priority_detections_found = []

            for box in results[0].boxes:
                cls = int(box.cls[0])
                species = model.names[cls].lower()
                conf = float(box.conf[0])
                
                if conf > 0.7 and species in PRIORITY_ANIMALS:
                    priority_detections_found.append((species, conf))
                    
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    label = f"{species} {conf:.2f}"
                    cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
                    cv2.putText(annotated_frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
            
            # (Alerting logic)
            if priority_detections_found and (current_time - last_alert_times[cam_id]) > 10: # 10-sec cooldown
                species, conf = priority_detections_found[0]
                
                print(f"🚨 [{cam_id}] {species} detected!")
                data = {
                    "camera_id": cam_id, "species": species, "confidence": conf,
                    "zone": CAMERA_ZONES.get(cam_id, "unknown"), "priority": "high",
                    "timestamp": firestore.SERVER_TIMESTAMP,
                    "location": CAMERA_LOCATIONS.get(cam_id)
                }
                try:
                    db.collection("detections").add(data)
                    print(f"✅ [{cam_id}] Alert sent to Firestore!")
                    last_alert_times[cam_id] = current_time
                except Exception as e:
                    print(f"❌ [{cam_id}] Error sending: {e}")

            with lock:
                (flag, encodedImage) = cv2.imencode(".jpg", annotated_frame)
                if flag:
                    latest_frames[cam_id] = encodedImage.tobytes()
        
        except Exception as e:
            print(f"Error in processing frame for {cam_id}: {e}")

        # This sleep is for the stream, but the AI runs as fast as it can
        time.sleep(0.02) 

# --- 6. FLASK WEB SERVER (Unchanged) ---
app = Flask(__name__)
CORS(app)

def stream_generator(cam_id):
    while True:
        frame_bytes = None
        with lock:
            if latest_frames.get(cam_id):
                frame_bytes = latest_frames.get(cam_id)
        if frame_bytes is None:
            frame_bytes = placeholder_frame
            time.sleep(0.5)
        
        yield(b'--frame\r\n' b'Content-Type: image/jpeg\r\n\r\n' + 
              frame_bytes + b'\r\n')
        
        time.sleep(0.02)

@app.route("/video_feed/<cam_id>")
def video_feed(cam_id):
    if cam_id not in CAMERA_SOURCES:
        return "Camera not found", 404
    return Response(stream_generator(cam_id),
                    mimetype = "multipart/x-mixed-replace; boundary=frame")

# --- 7. START EVERYTHING (Unchanged) ---
if __name__ == '__main__':
    thread_cam_01 = threading.Thread(target=process_camera_feed, args=("cam_01", CAMERA_SOURCES["cam_01"]), daemon=True)
    thread_cam_01.start()
    print(f"Starting detection thread for cam_01 (Zone: {CAMERA_ZONES.get('cam_01', 'N/A')})")

    thread_cam_02 = threading.Thread(target=process_camera_feed, args=("cam_02", CAMERA_SOURCES["cam_02"]), daemon=True)
    thread_cam_02.start()
    print(f"Starting detection thread for cam_02 (Zone: {CAMERA_ZONES.get('cam_02', 'N/A')})")

    print("\nStarting Flask server...")
    app.run(host='0.0.0.0', port=5001, threaded=True, debug=False)