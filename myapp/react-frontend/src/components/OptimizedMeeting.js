import { useState, useEffect, useRef } from 'react';
import { webRTCService } from '../services/WebRTCService';
import { signalingService } from '../services/SignalingService';
import VideoTag from './VideoTag';
import '../styles/base.css';
import '../styles/meeting.css';
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaDesktop, FaPhoneSlash } from 'react-icons/fa';

function OptimizedMeeting({
  username,
  roomName,
  onLeaveMeeting
}) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [participants, setParticipants] = useState([]);
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenEnabled, setScreenEnabled] = useState(false);
  
  const localVideoRef = useRef(null);
  const screenStreamRef = useRef(null);
  
  // Initialize WebRTC and signaling
  useEffect(() => {
    // Set up signaling service callbacks
    signalingService.setCallbacks({
      onSignalingMessage: handleSignalingMessage,
      onParticipantJoined: handleParticipantJoined,
      onParticipantLeft: handleParticipantLeft,
      onRoomError: handleRoomError
    });
    
    // Set up WebRTC service callbacks
    webRTCService.setCallbacks({
      onIceCandidate: handleIceCandidate,
      onTrack: handleTrack,
      onConnectionStateChange: handleConnectionStateChange
    });
    
    // Initialize WebSocket connection
    signalingService.initializeWebSocket(roomName, username);

    // Clean up on unmount
    return () => {
      signalingService.close();
      webRTCService.closeAllConnections();
      
      // Stop all media tracks
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  // Handle signaling messages
  const handleSignalingMessage = async (message) => {
    const { type, from, to } = message;
    
    // Only process messages intended for this peer
    if (to !== username) return;
    
    switch (type) {
      case 'offer':
        await handleOffer(message);
        break;
        
      case 'answer':
        await handleAnswer(message);
        break;
        
      case 'ice_candidate':
        await handleRemoteIceCandidate(message);
        break;
        
      default:
        console.warn('Unknown message type:', type);
    }
  };
  
  // Handle new participant joining
  const handleParticipantJoined = async (participant) => {
    console.log('Participant joined:', participant);
    
    // Add to participants list
    setParticipants(prev => [...prev, participant]);
    
    // Create peer connection
    const peerConnection = webRTCService.createPeerConnection(participant.id);
    
    // Add local stream if available
    if (localStream) {
      webRTCService.addLocalStream(participant.id, localStream);
    }
    
    // Create and send offer
    const offer = await webRTCService.createOffer(participant.id);
    signalingService.sendOffer(participant.id, offer);
  };
  
  // Handle participant leaving
  const handleParticipantLeft = (participantId) => {
    console.log('Participant left:', participantId);
    
    // Remove from participants list
    setParticipants(prev => prev.filter(p => p.id !== participantId));
    
    // Remove remote stream
    setRemoteStreams(prev => {
      const newStreams = { ...prev };
      delete newStreams[participantId];
      return newStreams;
    });
    
    // Close peer connection
    webRTCService.closeConnection(participantId);
  };
  
  // Handle room error
  const handleRoomError = (error) => {
    console.error('Room error:', error);
    alert(`Error: ${error}`);
  };
  
  // Handle ICE candidate
  const handleIceCandidate = (peerId, candidate) => {
    signalingService.sendIceCandidate(peerId, candidate);
  };
  
  // Handle remote ICE candidate
  const handleRemoteIceCandidate = async (message) => {
    const { candidate, from } = message;
    await webRTCService.addIceCandidate(from, candidate);
  };
  
  // Handle offer
  const handleOffer = async (message) => {
    const { offer, from } = message;
    
    // Create peer connection if it doesn't exist
    if (!webRTCService.hasConnection(from)) {
      webRTCService.createPeerConnection(from);
      
      // Add local stream if available
      if (localStream) {
        webRTCService.addLocalStream(from, localStream);
      }
    }
    
    // Set remote description
    await webRTCService.setRemoteDescription(from, offer);
    
    // Create and send answer
    const answer = await webRTCService.createAnswer(from);
    signalingService.sendAnswer(from, answer);
  };
  
  // Handle answer
  const handleAnswer = async (message) => {
    const { answer, from } = message;
    await webRTCService.setRemoteDescription(from, answer);
  };
  
  // Handle track
  const handleTrack = (peerId, event) => {
    setRemoteStreams(prev => ({
      ...prev,
      [peerId]: event.streams[0]
    }));
  };
  
  // Handle connection state change
  const handleConnectionStateChange = (peerId, state) => {
    console.log(`Connection state for ${peerId}: ${state}`);
  };
  
  // Toggle microphone
  const toggleMicrophone = async () => {
    try {
      if (!localStream) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(stream);
        setMicEnabled(true);
        
        // Add audio track to all peer connections
        participants.forEach(participant => {
          webRTCService.addLocalStream(participant.id, stream);
        });
      } else {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = !audioTrack.enabled;
          setMicEnabled(audioTrack.enabled);
        }
      }
    } catch (error) {
      console.error('Error toggling microphone:', error);
      alert('Failed to access microphone. Please check your permissions.');
    }
  };
  
  // Toggle camera
  const toggleCamera = async () => {
    try {
      if (!localStream) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setLocalStream(stream);
        setCameraEnabled(true);
        
        // Add video track to all peer connections
        participants.forEach(participant => {
          webRTCService.addLocalStream(participant.id, stream);
        });
      } else {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = !videoTrack.enabled;
          setCameraEnabled(videoTrack.enabled);
        }
      }
    } catch (error) {
      console.error('Error toggling camera:', error);
      alert('Failed to access camera. Please check your permissions.');
    }
  };
  
  // Toggle screen sharing
  const toggleScreenShare = async () => {
    try {
      if (!screenEnabled) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        screenStreamRef.current = stream;
        setScreenEnabled(true);
        
        // Replace video track in all peer connections
        participants.forEach(participant => {
          webRTCService.addLocalStream(participant.id, stream);
        });
        
        // Handle stream ending
        stream.getVideoTracks()[0].onended = () => {
          setScreenEnabled(false);
          screenStreamRef.current = null;
          
          // Restore camera track if it was enabled
          if (cameraEnabled && localStream) {
            participants.forEach(participant => {
              webRTCService.addLocalStream(participant.id, localStream);
            });
          }
        };
      } else {
        // Stop screen sharing
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        setScreenEnabled(false);
        screenStreamRef.current = null;
        
        // Restore camera track if it was enabled
        if (cameraEnabled && localStream) {
          participants.forEach(participant => {
            webRTCService.addLocalStream(participant.id, localStream);
          });
        }
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
      alert('Failed to share screen. Please check your permissions.');
    }
  };
  
  // Leave meeting
  const leaveMeeting = () => {
    // Stop all media tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Close all connections
    webRTCService.closeAllConnections();
    signalingService.close();
    
    // Call the onLeaveMeeting callback
    onLeaveMeeting();
  };
  
  return (
    <div className="meeting-container">
      <div className="meeting-header">
        <div className="meeting-info">
          <div className="meeting-id">Meeting ID: {roomName}</div>
          <div className="user-name">
            <span className="name-text">{username}</span>
          </div>
        </div>
      </div>
      
      <div className="video-grid">
        {participants.length > 0 ? (
          participants.map(participant => (
            <div key={participant.id} className="participant-video">
              <div className="video-container">
                {remoteStreams[participant.id] ? (
                  <VideoTag srcObject={remoteStreams[participant.id]} />
                ) : (
                  <div className="no-video-placeholder">
                    <div className="user-avatar">{participant.name.charAt(0).toUpperCase()}</div>
                  </div>
                )}
              </div>
              <div className="participant-name">
                {participant.name}
              </div>
            </div>
          ))
        ) : (
          <div className="waiting-participants">
            <p>Waiting for others to join...</p>
          </div>
        )}
      </div>
      
      {localStream && (
        <div className="local-video">
          <VideoTag
            ref={localVideoRef}
            muted={true}
            srcObject={localStream}
          />
          <div className="participant-name">You</div>
        </div>
      )}
      
      <div className="controls-container">
        <button 
          className={`control-btn ${micEnabled ? 'active' : ''}`}
          onClick={toggleMicrophone}
          title={micEnabled ? "Mute" : "Unmute"}
        >
          {micEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
        </button>
        
        <button 
          className={`control-btn ${cameraEnabled ? 'active' : ''}`}
          onClick={toggleCamera}
          title={cameraEnabled ? "Stop Video" : "Start Video"}
        >
          {cameraEnabled ? <FaVideo /> : <FaVideoSlash />}
        </button>
        
        <button 
          className={`control-btn ${screenEnabled ? 'active' : ''}`}
          onClick={toggleScreenShare}
          title={screenEnabled ? "Stop Screen Share" : "Share Screen"}
        >
          <FaDesktop />
        </button>
        
        <button 
          className="control-btn leave"
          onClick={leaveMeeting}
          title="Leave Meeting"
        >
          <FaPhoneSlash />
        </button>
      </div>
    </div>
  );
}

export default OptimizedMeeting; 