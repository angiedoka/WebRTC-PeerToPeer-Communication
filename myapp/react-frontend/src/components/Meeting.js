import VideoTag from './VideoTag';
import '../styles/base.css';
import '../styles/meeting.css';
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaDesktop, FaPhoneSlash } from 'react-icons/fa';

function Meeting({
  handleMicBtn,
  handleCameraBtn,
  handelScreenBtn,
  handleLeaveBtn,
  localVideoStream,
  onlineUsers,
  remoteTracks,
  username,
  roomName,
  meetingInfo,
  micShared,
  cameraShared,
  screenShared,
}) {
  let userStreamMap = {};
  for (let trackItem of remoteTracks) {
    if (!userStreamMap[trackItem.participantSessionId]) {
      userStreamMap[trackItem.participantSessionId] = [];
    }
    userStreamMap[trackItem.participantSessionId].push(trackItem);
  }

  let remoteParticipantTags = [];
  for (let user of onlineUsers) {
    if (user._id === meetingInfo.participantSessionId) {
      continue;
    }
    
    let videoTags = [];
    if (userStreamMap[user._id]?.length > 0) {
      for (let trackItem of userStreamMap[user._id]) {
        let stream = new MediaStream();
        stream.addTrack(trackItem.track);

        videoTags.push(
          <VideoTag 
            key={trackItem.streamId} 
            srcObject={stream} 
            style={trackItem.type === "audio" ? { display: "none" } : {}}
          />
        );
      }
    }

    remoteParticipantTags.push(
      <div key={user._id} className="participant-video">
        <div className="video-container">
          {videoTags.length > 0 ? videoTags : (
            <div className="no-video-placeholder">
              <div className="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
            </div>
          )}
        </div>
        <div className="participant-name">{user.name}</div>
      </div>
    );
  }

  return (
    <div className="meeting-container">
      <div className="meeting-header">
        <div className="meeting-info">
          <span className="meeting-id">Meeting ID: {roomName}</span>
          <span className="user-name">{username}</span>
        </div>
      </div>

      <div className="video-grid">
        {remoteParticipantTags.length > 0 ? remoteParticipantTags : (
          <div className="waiting-participants">
            <p>Waiting for others to join...</p>
          </div>
        )}
      </div>

      {localVideoStream && (
        <div className="local-video">
          <VideoTag
            muted={true}
            srcObject={localVideoStream}
          />
          <div className="participant-name">You</div>
        </div>
      )}

      <div className="controls-container">
        <button 
          className={`control-btn ${micShared ? 'active' : ''}`}
          onClick={handleMicBtn}
          title={micShared ? "Mute" : "Unmute"}
        >
          {micShared ? <FaMicrophone /> : <FaMicrophoneSlash />}
        </button>
        
        <button 
          className={`control-btn ${cameraShared ? 'active' : ''}`}
          onClick={handleCameraBtn}
          title={cameraShared ? "Stop Video" : "Start Video"}
        >
          {cameraShared ? <FaVideo /> : <FaVideoSlash />}
        </button>
        
        <button 
          className={`control-btn ${screenShared ? 'active' : ''}`}
          onClick={handelScreenBtn}
          title={screenShared ? "Stop Screen Share" : "Share Screen"}
        >
          <FaDesktop />
        </button>
        
        <button 
          className="control-btn leave"
          onClick={handleLeaveBtn}
          title="Leave Meeting"
        >
          <FaPhoneSlash />
        </button>
      </div>
    </div>
  );
}

export default Meeting;