// Signaling optimization utilities for WebRTC

/**
 * ICE Candidate Optimization
 * Filters and prioritizes ICE candidates for better connection establishment
 */
export const optimizeIceCandidates = (candidates) => {
  // Filter out duplicate candidates
  const uniqueCandidates = candidates.filter((candidate, index, self) => 
    index === self.findIndex((c) => (
      c.candidate === candidate.candidate && 
      c.sdpMid === candidate.sdpMid
    ))
  );
  
  // Prioritize candidates by type (host > srflx > relay)
  return uniqueCandidates.sort((a, b) => {
    const getPriority = (candidate) => {
      if (candidate.includes('host')) return 3;
      if (candidate.includes('srflx')) return 2;
      if (candidate.includes('relay')) return 1;
      return 0;
    };
    
    return getPriority(b.candidate) - getPriority(a.candidate);
  });
};

/**
 * Connection Quality Monitor
 * Monitors WebRTC connection quality and provides feedback
 */
export class ConnectionQualityMonitor {
  constructor(peerConnection, onQualityChange) {
    this.peerConnection = peerConnection;
    this.onQualityChange = onQualityChange;
    this.statsInterval = null;
    this.lastBitrate = 0;
    this.lastTimestamp = 0;
  }
  
  startMonitoring(intervalMs = 1000) {
    this.statsInterval = setInterval(() => {
      this.peerConnection.getStats().then(stats => {
        let totalBitrate = 0;
        let packetsLost = 0;
        let totalPackets = 0;
        
        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            const now = report.timestamp;
            const bytes = report.bytesReceived;
            
            if (this.lastTimestamp) {
              const bitrate = 8 * (bytes - this.lastBitrate) / (now - this.lastTimestamp);
              totalBitrate += bitrate;
            }
            
            this.lastBitrate = bytes;
            this.lastTimestamp = now;
            
            if (report.packetsLost !== undefined) {
              packetsLost += report.packetsLost;
              totalPackets += report.packetsReceived + report.packetsLost;
            }
          }
        });
        
        // Calculate quality metrics
        const packetLossRate = totalPackets > 0 ? packetsLost / totalPackets : 0;
        let quality = 'good';
        
        if (totalBitrate < 100000) { // Less than 100 kbps
          quality = 'poor';
        } else if (totalBitrate < 500000) { // Less than 500 kbps
          quality = 'fair';
        }
        
        if (packetLossRate > 0.05) { // More than 5% packet loss
          quality = 'poor';
        } else if (packetLossRate > 0.01) { // More than 1% packet loss
          quality = 'fair';
        }
        
        this.onQualityChange(quality, {
          bitrate: totalBitrate,
          packetLossRate,
          timestamp: Date.now()
        });
      });
    }, intervalMs);
  }
  
  stopMonitoring() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }
}

/**
 * Connection State Manager
 * Manages WebRTC connection states and provides reconnection logic
 */
export class ConnectionStateManager {
  constructor(peerConnection, onStateChange) {
    this.peerConnection = peerConnection;
    this.onStateChange = onStateChange;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.reconnectDelay = 1000; // Start with 1 second
  }
  
  startMonitoring() {
    this.peerConnection.addEventListener('connectionstatechange', () => {
      const state = this.peerConnection.connectionState;
      this.onStateChange(state);
      
      if (state === 'disconnected' || state === 'failed') {
        this.handleDisconnection();
      }
    });
    
    this.peerConnection.addEventListener('iceconnectionstatechange', () => {
      const state = this.peerConnection.iceConnectionState;
      
      if (state === 'disconnected' || state === 'failed') {
        this.handleDisconnection();
      }
    });
  }
  
  handleDisconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      
      // Exponential backoff
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      setTimeout(() => {
        // Attempt to restart ICE
        this.peerConnection.restartIce();
      }, delay);
    }
  }
  
  resetReconnectAttempts() {
    this.reconnectAttempts = 0;
  }
}

/**
 * Media Negotiation Optimizer
 * Optimizes the media negotiation process for faster connection establishment
 */
export const optimizeMediaNegotiation = (peerConnection, localStream) => {
  // Set bandwidth constraints for better performance
  const senders = peerConnection.getSenders();
  
  senders.forEach(sender => {
    if (sender.track && sender.track.kind === 'video') {
      const parameters = sender.getParameters();
      
      if (!parameters.encodings) {
        parameters.encodings = [{}];
      }
      
      // Set maxBitrate to 1 Mbps for video
      parameters.encodings[0].maxBitrate = 1000000;
      
      // Enable simulcast for better adaptation
      if (parameters.encodings.length === 1) {
        parameters.encodings.push({ maxBitrate: 500000 });
        parameters.encodings.push({ maxBitrate: 150000 });
      }
      
      sender.setParameters(parameters).catch(e => console.error('Error setting parameters:', e));
    }
  });
  
  // Set optimal video constraints
  if (localStream) {
    const videoTracks = localStream.getVideoTracks();
    videoTracks.forEach(track => {
      const capabilities = track.getCapabilities();
      
      if (capabilities.width && capabilities.height) {
        // Prefer 720p for better performance
        track.applyConstraints({
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          frameRate: { ideal: 30, max: 30 }
        }).catch(e => console.error('Error applying constraints:', e));
      }
    });
  }
};

/**
 * Fallback Mechanism
 * Provides fallback options when primary connection methods fail
 */
export const setupFallbackMechanism = (peerConnection) => {
  // Store original createOffer method
  const originalCreateOffer = peerConnection.createOffer.bind(peerConnection);
  
  // Override createOffer to include fallback options
  peerConnection.createOffer = async (options = {}) => {
    try {
      // First try with preferred codecs
      return await originalCreateOffer(options);
    } catch (error) {
      console.warn('Failed to create offer with preferred options, trying fallback:', error);
      
      // Fallback to more compatible options
      const fallbackOptions = {
        ...options,
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        voiceActivityDetection: true
      };
      
      return await originalCreateOffer(fallbackOptions);
    }
  };
  
  return peerConnection;
}; 