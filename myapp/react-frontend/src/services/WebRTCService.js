import { 
  optimizeIceCandidates, 
  ConnectionQualityMonitor, 
  ConnectionStateManager, 
  optimizeMediaNegotiation,
  setupFallbackMechanism
} from '../utils/signalingOptimizer';

/**
 * WebRTC Service
 * Handles WebRTC connections with optimized signaling
 */
class WebRTCService {
  constructor() {
    this.peerConnections = new Map();
    this.qualityMonitors = new Map();
    this.stateManagers = new Map();
    this.onConnectionStateChange = null;
    this.onQualityChange = null;
    this.onIceCandidate = null;
    this.onTrack = null;
  }

  /**
   * Initialize a new peer connection with optimized settings
   */
  createPeerConnection(peerId, config = {}) {
    // Default ICE servers configuration
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ];

    // Create RTCPeerConnection with optimized configuration
    const peerConnection = new RTCPeerConnection({
      iceServers: config.iceServers || iceServers,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 10
    });

    // Apply fallback mechanism
    setupFallbackMechanism(peerConnection);

    // Set up event handlers
    this.setupPeerConnectionEvents(peerConnection, peerId);

    // Store the connection
    this.peerConnections.set(peerId, peerConnection);

    return peerConnection;
  }

  /**
   * Set up event handlers for a peer connection
   */
  setupPeerConnectionEvents(peerConnection, peerId) {
    // ICE candidate event
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Optimize ICE candidates
        const optimizedCandidate = optimizeIceCandidates([event.candidate])[0];
        
        if (this.onIceCandidate) {
          this.onIceCandidate(peerId, optimizedCandidate);
        }
      }
    };

    // Track event
    peerConnection.ontrack = (event) => {
      if (this.onTrack) {
        this.onTrack(peerId, event);
      }
    };

    // Connection state change
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(peerId, state);
      }
    };

    // ICE connection state change
    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(peerId, state);
      }
    };

    // ICE gathering state change
    peerConnection.onicegatheringstatechange = () => {
      const state = peerConnection.iceGatheringState;
      
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(peerId, state);
      }
    };

    // Signaling state change
    peerConnection.onsignalingstatechange = () => {
      const state = peerConnection.signalingState;
      
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(peerId, state);
      }
    };
  }

  /**
   * Start monitoring connection quality for a peer
   */
  startQualityMonitoring(peerId, onQualityChange) {
    const peerConnection = this.peerConnections.get(peerId);
    
    if (peerConnection) {
      const monitor = new ConnectionQualityMonitor(peerConnection, onQualityChange);
      monitor.startMonitoring();
      this.qualityMonitors.set(peerId, monitor);
    }
  }

  /**
   * Stop monitoring connection quality for a peer
   */
  stopQualityMonitoring(peerId) {
    const monitor = this.qualityMonitors.get(peerId);
    
    if (monitor) {
      monitor.stopMonitoring();
      this.qualityMonitors.delete(peerId);
    }
  }

  /**
   * Start monitoring connection state for a peer
   */
  startStateMonitoring(peerId, onStateChange) {
    const peerConnection = this.peerConnections.get(peerId);
    
    if (peerConnection) {
      const manager = new ConnectionStateManager(peerConnection, onStateChange);
      manager.startMonitoring();
      this.stateManagers.set(peerId, manager);
    }
  }

  /**
   * Stop monitoring connection state for a peer
   */
  stopStateMonitoring(peerId) {
    const manager = this.stateManagers.get(peerId);
    
    if (manager) {
      this.stateManagers.delete(peerId);
    }
  }

  /**
   * Add a local media stream to a peer connection
   */
  addLocalStream(peerId, stream) {
    const peerConnection = this.peerConnections.get(peerId);
    
    if (peerConnection && stream) {
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });
      
      // Optimize media negotiation
      optimizeMediaNegotiation(peerConnection, stream);
    }
  }

  /**
   * Create and send an offer to a peer
   */
  async createOffer(peerId, options = {}) {
    const peerConnection = this.peerConnections.get(peerId);
    
    if (peerConnection) {
      try {
        const offer = await peerConnection.createOffer(options);
        await peerConnection.setLocalDescription(offer);
        return offer;
      } catch (error) {
        console.error('Error creating offer:', error);
        throw error;
      }
    }
    
    throw new Error(`No peer connection found for peer ${peerId}`);
  }

  /**
   * Create and send an answer to a peer
   */
  async createAnswer(peerId, options = {}) {
    const peerConnection = this.peerConnections.get(peerId);
    
    if (peerConnection) {
      try {
        const answer = await peerConnection.createAnswer(options);
        await peerConnection.setLocalDescription(answer);
        return answer;
      } catch (error) {
        console.error('Error creating answer:', error);
        throw error;
      }
    }
    
    throw new Error(`No peer connection found for peer ${peerId}`);
  }

  /**
   * Set remote description for a peer
   */
  async setRemoteDescription(peerId, description) {
    const peerConnection = this.peerConnections.get(peerId);
    
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(description));
      } catch (error) {
        console.error('Error setting remote description:', error);
        throw error;
      }
    } else {
      throw new Error(`No peer connection found for peer ${peerId}`);
    }
  }

  /**
   * Add an ICE candidate for a peer
   */
  async addIceCandidate(peerId, candidate) {
    const peerConnection = this.peerConnections.get(peerId);
    
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
        throw error;
      }
    } else {
      throw new Error(`No peer connection found for peer ${peerId}`);
    }
  }

  /**
   * Close a peer connection
   */
  closeConnection(peerId) {
    const peerConnection = this.peerConnections.get(peerId);
    
    if (peerConnection) {
      // Stop quality monitoring
      this.stopQualityMonitoring(peerId);
      
      // Stop state monitoring
      this.stopStateMonitoring(peerId);
      
      // Close the connection
      peerConnection.close();
      
      // Remove from map
      this.peerConnections.delete(peerId);
    }
  }

  /**
   * Close all peer connections
   */
  closeAllConnections() {
    for (const [peerId] of this.peerConnections) {
      this.closeConnection(peerId);
    }
  }

  /**
   * Set callbacks for connection events
   */
  setCallbacks(callbacks) {
    if (callbacks.onConnectionStateChange) {
      this.onConnectionStateChange = callbacks.onConnectionStateChange;
    }
    
    if (callbacks.onQualityChange) {
      this.onQualityChange = callbacks.onQualityChange;
    }
    
    if (callbacks.onIceCandidate) {
      this.onIceCandidate = callbacks.onIceCandidate;
    }
    
    if (callbacks.onTrack) {
      this.onTrack = callbacks.onTrack;
    }
  }
}

// Export a singleton instance
export const webRTCService = new WebRTCService(); 