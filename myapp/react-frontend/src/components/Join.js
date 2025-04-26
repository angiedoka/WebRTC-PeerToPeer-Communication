import { useState } from 'react';
import '../styles/base.css';
import '../styles/join.css';
import { FaVideo } from 'react-icons/fa';

export default function Join({ handleCreateMeeting, handleJoinMeeting }) {
  const [username, setUsername] = useState('');
  const [roomName, setRoomName] = useState('');

  return (
    <div className="join-container">
      <div className="platform-header">
        <div className="logo-container">
          <FaVideo className="logo-icon" />
          <h1 className="platform-name">WebRTC Peer-to-Peer Communication</h1>
        </div>
        <p className="platform-tagline">Seamless video communication for everyone</p>
      </div>
      
      <div className="join-card">
        <h2>Video Chat</h2>
        
        <div className="form-group">
          <label>Your Name</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name"
          />
        </div>

        <div className="divider">OR</div>

        <div className="form-group">
          <label>Meeting ID</label>
          <div className="input-group">
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Enter meeting ID"
            />
            <button 
              onClick={() => handleJoinMeeting(roomName, username)}
              disabled={!username || !roomName}
            >
              Join
            </button>
          </div>
        </div>

        <div className="divider">OR</div>

        <button
          className="create-btn"
          onClick={() => handleCreateMeeting(username)}
          disabled={!username}
        >
          Create New Meeting
        </button>
      </div>
    </div>
  );
}