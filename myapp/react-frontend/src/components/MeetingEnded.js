import '../styles/endmeeting.css';

function MeetingEnded({ onRejoin }) {
  return (
    <div className="meeting-ended-container">
      <div className="meeting-ended-content">
        <h2 className="meeting-ended-title">Meeting Has Ended</h2>
        
        <div className="meeting-ended-actions">
          <button 
            className="btn-secondary"
            onClick={() => window.location.href = '/'}
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default MeetingEnded;
