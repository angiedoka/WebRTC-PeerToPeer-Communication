import axios from 'axios';
import config from '../config';

/**
 * Signaling Service
 * Handles WebRTC signaling with optimizations
 */
class SignalingService {
  constructor() {
    this.apiLocation = config.api_location;
    this.socket = null;
    this.onSignalingMessage = null;
    this.onRoomCreated = null;
    this.onRoomJoined = null;
    this.onRoomError = null;
    this.onParticipantJoined = null;
    this.onParticipantLeft = null;
    this.roomName = null;
    this.username = null;
    this.pendingCandidates = new Map(); // Store candidates by peerId
  }

  /**
   * Initialize WebSocket connection for signaling
   */
  initializeWebSocket(roomName, username) {
    this.roomName = roomName;
    this.username = username;

    // Create WebSocket connection
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:${window.location.port}/ws/signaling/${roomName}`;
    
    this.socket = new WebSocket(wsUrl);
    
    // Set up event handlers
    this.socket.onopen = () => {
      console.log('WebSocket connection established');
      
      // Send join message
      this.sendSignalingMessage({
        type: 'join',
        roomName: this.roomName,
        username: this.username
      });
    };
    
    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleSignalingMessage(message);
    };
    
    this.socket.onclose = () => {
      console.log('WebSocket connection closed');
    };
    
    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      
      if (this.onRoomError) {
        this.onRoomError('WebSocket connection error');
      }
    };
  }

  /**
   * Handle incoming signaling messages
   */
  handleSignalingMessage(message) {
    console.log('Received signaling message:', message);
    
    switch (message.type) {
      case 'room_created':
        if (this.onRoomCreated) {
          this.onRoomCreated(message.roomName);
        }
        break;
        
      case 'room_joined':
        if (this.onRoomJoined) {
          this.onRoomJoined(message.participants);
        }
        break;
        
      case 'participant_joined':
        if (this.onParticipantJoined) {
          this.onParticipantJoined(message.participant);
        }
        break;
        
      case 'participant_left':
        if (this.onParticipantLeft) {
          this.onParticipantLeft(message.participantId);
        }
        break;
        
      case 'offer':
        if (this.onSignalingMessage) {
          this.onSignalingMessage(message);
        }
        break;
        
      case 'answer':
        if (this.onSignalingMessage) {
          this.onSignalingMessage(message);
        }
        break;
        
      case 'ice_candidate':
        if (this.onSignalingMessage) {
          this.onSignalingMessage(message);
        }
        break;
        
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Send a signaling message
   */
  sendSignalingMessage(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not open');
    }
  }

  /**
   * Create a new room
   */
  async createRoom() {
    try {
      const response = await axios.post(`${this.apiLocation}/api/create/room`);
      return response.data;
    } catch (error) {
      console.error('Error creating room:', error);
      throw error;
    }
  }

  /**
   * Join an existing room
   */
  async joinRoom(roomName) {
    try {
      const response = await axios.get(
        `${this.apiLocation}/api/validate-meeting?roomName=${roomName}`
      );
      
      if (response.data.roomFound) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Error joining room:', error);
      throw error;
    }
  }

  /**
   * Send an offer to a peer
   */
  sendOffer(peerId, offer) {
    this.sendSignalingMessage({
      type: 'offer',
      offer: offer,
      from: this.username,
      to: peerId
    });
  }

  /**
   * Send an answer to a peer
   */
  sendAnswer(peerId, answer) {
    this.sendSignalingMessage({
      type: 'answer',
      answer: answer,
      from: this.username,
      to: peerId
    });
  }

  /**
   * Send an ICE candidate to a peer
   */
  sendIceCandidate(peerId, candidate) {
    this.sendSignalingMessage({
      type: 'ice_candidate',
      candidate: candidate,
      from: this.username,
      to: peerId
    });
  }

  /**
   * Store a pending ICE candidate
   */
  storePendingCandidate(peerId, candidate) {
    if (!this.pendingCandidates.has(peerId)) {
      this.pendingCandidates.set(peerId, []);
    }
    
    this.pendingCandidates.get(peerId).push(candidate);
  }

  /**
   * Get pending ICE candidates for a peer
   */
  getPendingCandidates(peerId) {
    return this.pendingCandidates.get(peerId) || [];
  }

  /**
   * Clear pending ICE candidates for a peer
   */
  clearPendingCandidates(peerId) {
    this.pendingCandidates.delete(peerId);
  }

  /**
   * Close the signaling connection
   */
  close() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  /**
   * Set callbacks for signaling events
   */
  setCallbacks(callbacks) {
    if (callbacks.onSignalingMessage) {
      this.onSignalingMessage = callbacks.onSignalingMessage;
    }
    
    if (callbacks.onRoomCreated) {
      this.onRoomCreated = callbacks.onRoomCreated;
    }
    
    if (callbacks.onRoomJoined) {
      this.onRoomJoined = callbacks.onRoomJoined;
    }
    
    if (callbacks.onRoomError) {
      this.onRoomError = callbacks.onRoomError;
    }
    
    if (callbacks.onParticipantJoined) {
      this.onParticipantJoined = callbacks.onParticipantJoined;
    }
    
    if (callbacks.onParticipantLeft) {
      this.onParticipantLeft = callbacks.onParticipantLeft;
    }
  }
}

// Export a singleton instance
export const signalingService = new SignalingService(); 