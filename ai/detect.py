import cv2
import time
import firebase_admin
from firebase_admin import credentials, firestore
from ultralytics import YOLO
from flask import Flask, Response
from flask_cors import CORS # Import CORS

# --- Setup ---
cred = credentials.Certificate("serviceAccount.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

model = YOLO("best.pt")
cap = cv2.VideoCapture("")

#cap = cv2.VideoCapture("http://192.168.137.39:4747/video")

# --- HARD-CODE YOUR CAMERA'S LOCATION ---
# (Using the test location from before)
CAMERA_LATITUDE = 11.0573
CAMERA_LONGITUDE = 77.1135

# --- Flask App Setup ---
app = Flask(__name__)
CORS(app) # Allow your React app (from localhost:3000) to connect

# --- Global variable to prevent spamming Firestore ---
last_alert_time = 0

def generate_frames():
    global last_alert_time # Access the global variable

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Run YOLO detection
        results = model(frame)
        annotated_frame = results[0].plot() # Draw boxes on the frame

        # Check for detections
        for r in results:
            for box in r.boxes:
                cls = int(box.cls[0])
                species = model.names[cls]
                conf = float(box.conf[0])

                # --- Check for animal and send alert ---
                if conf > 0.7 and species.lower() in ["elephant", "tiger", "boar", "leopard", "human"]:
                    
                    # Check if 5 seconds have passed since the last alert
                    current_time = time.time()
                    if (current_time - last_alert_time) > 5:
                        print(f"🚨 {species} detected! (Conf: {conf:.2f})")
                        
                        data = {
                            "camera_id": "cam_01_streaming",
                            "species": species,
                            "confidence": conf,
                            "zone": "C",
                            "priority": "high",
                            "timestamp": firestore.SERVER_TIMESTAMP,
                            "location": {
                                "lat": CAMERA_LATITUDE,
                                "lon": CAMERA_LONGITUDE
                            }
                        }
                        
                        # Send to Firestore
                        try:
                            db.collection("detections").add(data)
                            print("✅ Alert with location sent to Firestore!")
                            last_alert_time = current_time # Reset cooldown
                        except Exception as e:
                            print(f"❌ Error sending to Firestore: {e}")

        # --- Encode the annotated frame to JPEG ---
        (flag, encodedImage) = cv2.imencode(".jpg", annotated_frame)
        if not flag:
            continue

        # --- Yield the frame in the byte format for streaming ---
        yield(b'--frame\r\n' b'Content-Type: image/jpeg\r\n\r\n' + 
              bytearray(encodedImage) + b'\r\n')

@app.route("/video_feed")
def video_feed():
    # Return the streaming response
    return Response(generate_frames(),
                    mimetype = "multipart/x-mixed-replace; boundary=frame")

# Start the Flask server
if __name__ == '__main__':
    print("Starting Flask server... Access the stream at http://localhost:5001/video_feed")
    # Run on port 5001 so it doesn't conflict with React (port 3000)
    app.run(host='0.0.0.0', port=5001, threaded=True, debug=False)