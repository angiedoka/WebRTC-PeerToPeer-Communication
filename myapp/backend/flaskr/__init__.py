import os
import json
import requests
from flask import Flask, request
from flask_cors import CORS
from flask_sock import Sock

app = Flask(__name__)
CORS(app)  # Enable CORS so frontend can access this API
sock = Sock(app)  # Initialize WebSocket support

# Load your secret key and domain from the .env file
METERED_SECRET_KEY = os.environ.get("METERED_SECRET_KEY")
METERED_DOMAIN = os.environ.get("METERED_DOMAIN")

# Store active rooms and participants
active_rooms = {}
active_participants = {}


# API: Create a meeting room
@app.route("/api/create/room", methods=['POST'])
def create_room():
    r = requests.post(f"https://{METERED_DOMAIN}/api/v1/room?secretKey={METERED_SECRET_KEY}")
    return r.json()


# API: Validate a meeting room by roomName
@app.route("/api/validate-meeting")
def validate_meeting():
    roomName = request.args.get("roomName")
    if roomName:
        r = requests.get(f"https://{METERED_DOMAIN}/api/v1/room/{roomName}?secretKey={METERED_SECRET_KEY}")
        data = r.json()
        if data.get("roomName"):
            return {"roomFound": True}
        else:
            return {"roomFound": False}
    else:
        return {
            "success": False,
            "message": "Please specify roomName"
        }


# API: Return Metered Domain
@app.route("/api/metered-domain")
def get_metered_domain():
    return {"METERED_DOMAIN": METERED_DOMAIN}


# WebSocket endpoint for signaling
@sock.route('/ws/signaling/<room_name>')
def signaling(ws, room_name):
    participant_id = None
    participant_name = None
    
    try:
        # Initialize room if it doesn't exist
        if room_name not in active_rooms:
            active_rooms[room_name] = {
                'participants': {},
                'created_at': os.time()
            }
        
        # Handle WebSocket messages
        while True:
            message = json.loads(ws.receive())
            
            # Handle different message types
            if message['type'] == 'join':
                # New participant joining
                participant_id = message.get('participantId', str(len(active_rooms[room_name]['participants'])))
                participant_name = message.get('username', f'User-{participant_id}')
                
                # Store participant info
                active_rooms[room_name]['participants'][participant_id] = {
                    'name': participant_name,
                    'ws': ws,
                    'joined_at': os.time()
                }
                
                # Notify all participants about the new join
                for pid, participant in active_rooms[room_name]['participants'].items():
                    if pid != participant_id:
                        try:
                            participant['ws'].send(json.dumps({
                                'type': 'participant_joined',
                                'participant': {
                                    'id': participant_id,
                                    'name': participant_name
                                }
                            }))
                        except Exception as e:
                            print(f"Error sending to participant {pid}: {e}")
                
                # Send room info to the new participant
                ws.send(json.dumps({
                    'type': 'room_joined',
                    'participants': [
                        {'id': pid, 'name': p['name']} 
                        for pid, p in active_rooms[room_name]['participants'].items() 
                        if pid != participant_id
                    ]
                }))
                
            elif message['type'] == 'offer':
                # Forward offer to the target participant
                target_id = message.get('to')
                if target_id in active_rooms[room_name]['participants']:
                    try:
                        active_rooms[room_name]['participants'][target_id]['ws'].send(json.dumps(message))
                    except Exception as e:
                        print(f"Error forwarding offer to {target_id}: {e}")
                
            elif message['type'] == 'answer':
                # Forward answer to the target participant
                target_id = message.get('to')
                if target_id in active_rooms[room_name]['participants']:
                    try:
                        active_rooms[room_name]['participants'][target_id]['ws'].send(json.dumps(message))
                    except Exception as e:
                        print(f"Error forwarding answer to {target_id}: {e}")
                
            elif message['type'] == 'ice_candidate':
                # Forward ICE candidate to the target participant
                target_id = message.get('to')
                if target_id in active_rooms[room_name]['participants']:
                    try:
                        active_rooms[room_name]['participants'][target_id]['ws'].send(json.dumps(message))
                    except Exception as e:
                        print(f"Error forwarding ICE candidate to {target_id}: {e}")
                
            elif message['type'] == 'leave':
                # Participant leaving
                if participant_id and participant_id in active_rooms[room_name]['participants']:
                    # Notify all participants about the leave
                    for pid, participant in active_rooms[room_name]['participants'].items():
                        if pid != participant_id:
                            try:
                                participant['ws'].send(json.dumps({
                                    'type': 'participant_left',
                                    'participantId': participant_id
                                }))
                            except Exception as e:
                                print(f"Error sending to participant {pid}: {e}")
                    
                    # Remove participant from the room
                    del active_rooms[room_name]['participants'][participant_id]
                    
                    # If room is empty, remove it
                    if not active_rooms[room_name]['participants']:
                        del active_rooms[room_name]
                
                break
    
    except Exception as e:
        print(f"WebSocket error: {e}")
    
    finally:
        # Clean up when participant leaves
        if participant_id and room_name in active_rooms and participant_id in active_rooms[room_name]['participants']:
            # Notify all participants about the leave
            for pid, participant in active_rooms[room_name]['participants'].items():
                if pid != participant_id:
                    try:
                        participant['ws'].send(json.dumps({
                            'type': 'participant_left',
                            'participantId': participant_id
                        }))
                    except Exception as e:
                        print(f"Error sending to participant {pid}: {e}")
            
            # Remove participant from the room
            del active_rooms[room_name]['participants'][participant_id]
            
            # If room is empty, remove it
            if not active_rooms[room_name]['participants']:
                del active_rooms[room_name]


# Root endpoint
@app.route("/")
def index():
    return "Backend"
