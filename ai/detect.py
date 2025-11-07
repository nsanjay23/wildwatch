import cv2
import time
import firebase_admin
from firebase_admin import credentials, firestore
from ultralytics import YOLO
import gdown
import os
from collections import Counter

# --- 1. FILE DOWNLOADER ---
# --- 1. FILE DOWNLOADER ---
FILE_IDS = {
    "best.pt": "1qMt6JwWXJv5yzbOQb5oH1LwXtnP2vMvv",
    "test_video.mp4": "1DX2pjg2dJXeUSKcgfekhDcwVBpyKPCXn"
}

def download_files_if_missing():
    for filename, file_id in FILE_IDS.items():
        if not os.path.exists(filename):
            print(f"'{filename}' not found. Downloading...")
            try:
                url = f'https://drive.google.com/uc?id={file_id}'
                gdown.download(url, filename, quiet=False)
                print(f"'{filename}' downloaded successfully.")
            except Exception as e:
                print(f"!!! ERROR: Failed to download {filename}.")
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

print("Loading CUSTOM model (best.pt) for animals...")
model_custom = YOLO("best.pt") 
print("Loading DEFAULT model (yolov8s.pt) for humans...")
model_default = YOLO("yolov8s.pt") 
print("All models loaded.")

# --- 3. CONFIGURATION ---
CAMERA_ID = "cam_02"
CAMERA_SOURCE = "test_video.mp4"
PRIORITY_ANIMALS = ["elephant", "tiger", "leopard", "boar", "bear"]
HUMAN_CLASS = "person" 

# (Fetch camera config from Firestore)
CAMERA_ZONE = "A"
CAMERA_LOCATION = {"lat": 11.0168, "lon": 76.9558}
try:
    print(f"Fetching camera config for {CAMERA_ID} from Firestore...")
    cam_doc = db.collection("cameras").document(CAMERA_ID).get()
    if cam_doc.exists:
        cam_data = cam_doc.to_dict()
        CAMERA_ZONE = cam_data.get("zone", "unknown")
        CAMERA_LOCATION = cam_data.get("location", None)
        print(f"- Found config for {CAMERA_ID}: Zone {CAMERA_ZONE}")
except Exception as e:
    print(f"!!! Error fetching config: {e}. Using defaults.")

# --- 4. MAIN PROCESSING LOOP ---
def run_detection():
    cap = cv2.VideoCapture(CAMERA_SOURCE)
    if not cap.isOpened():
        print(f"!!! CRITICAL ERROR: Could not open video file: {CAMERA_SOURCE}")
        return

    detection_counts = Counter()
    current_most_frequent = None
    last_alert_time = 0
    last_ai_run_time = 0
    ai_run_interval = 1 # Throttled to 1 FPS (still lag-free)

    print(f"Starting detection on {CAMERA_ID} (test_video.mp4)...")
    print("Press 'q' in the video window to quit.")

    while True:
        ret, frame = cap.read()
        if not ret:
            print(f"[{CAMERA_ID}] Video finished. Looping...")
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            detection_counts.clear()
            current_most_frequent = None
            continue
        
        try:
            small_frame = cv2.resize(frame, (640, 480))
            current_time = time.time()
            annotated_frame = small_frame.copy() # Start with a clean frame

            if (current_time - last_ai_run_time) > ai_run_interval:
                last_ai_run_time = current_time 
                
                results_animals = model_custom(small_frame, verbose=False)
                results_humans = model_default(small_frame, verbose=False)
                
                animals_in_frame = []
                humans_in_frame = []
                is_human_present = False

                # (Loop 1: Find Animals and COUNT them)
                for box in results_animals[0].boxes:
                    cls = int(box.cls[0])
                    species = model_custom.names[cls].lower()
                    conf = float(box.conf[0])
                    
                    if conf > 0.7 and species in PRIORITY_ANIMALS:
                        animals_in_frame.append({"species": species, "conf": conf, "box": box.xyxy[0]})
                        detection_counts[species] += 1
                
                # (Loop 2: Find Humans)
                for box in results_humans[0].boxes:
                    cls = int(box.cls[0])
                    species = model_default.names[cls].lower()
                    conf = float(box.conf[0])
                    
                    if conf > 0.5 and species == HUMAN_CLASS: 
                        is_human_present = True
                        humans_in_frame.append({"species": species, "conf": conf, "box": box.xyxy[0]})

                # (Find the "Winner")
                if detection_counts:
                    current_most_frequent = detection_counts.most_common(1)[0][0]
                
                # (Loop 3: Draw Annotations on 'annotated_frame')
                for animal in animals_in_frame:
                    if animal["species"] == current_most_frequent:
                        x1, y1, x2, y2 = map(int, animal["box"])
                        label = f"{animal['species']} {animal['conf']:.2f}"
                        cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 0, 255), 2) 
                        cv2.putText(annotated_frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
                
                for human in humans_in_frame:
                    x1, y1, x2, y2 = map(int, human["box"])
                    label = f"{human['species']} {human['conf']:.2f}"
                    cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 255), 2) 
                    cv2.putText(annotated_frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 2)
                
                # (Alerting Logic)
                if current_most_frequent and (current_time - last_alert_time) > 10:
                    first_animal = next((a for a in animals_in_frame if a["species"] == current_most_frequent), None)
                    alert_conf = first_animal["conf"] if first_animal else 0.9

                    data = {
                        "camera_id": CAMERA_ID, "species": current_most_frequent, "confidence": alert_conf,
                        "zone": CAMERA_ZONE, "priority": "high",
                        "timestamp": firestore.SERVER_TIMESTAMP,
                        "location": CAMERA_LOCATION
                    }

                    if is_human_present:
                        print(f"🚨🚨🚨 CRITICAL: {current_most_frequent} WITH {HUMAN_CLASS} DETECTED! 🚨🚨🚨")
                        data["alert_type"] = "HIGH_RISK_HUMAN_INTERACTION"
                        data["priority"] = "critical"
                    else:
                        print(f"🚨 [{CAMERA_ID}] {current_most_frequent} detected!")
                        data["alert_type"] = "Animal Presence"
                    
                    try:
                        db.collection("detections").add(data)
                        print(f"✅ [{CAMERA_ID}] Alert sent to Firestore!")
                        last_alert_time = current_time
                    except Exception as e:
                        print(f"❌ [{CAMERA_ID}] Error sending: {e}")
            
            # --- DISPLAY THE FRAME ---
            # Show the annotated frame in a local OpenCV window
            cv2.imshow("WildWatch AI Demo (Press 'q' to quit)", annotated_frame)
        
        except Exception as e:
            print(f"Error in processing frame: {e}")

        # Check for 'q' key press to quit
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # Clean up
    cap.release()
    cv2.destroyAllWindows()
    print("Detection stopped.")

# --- 5. START EVERYTHING ---
if __name__ == '__main__':
    run_detection()