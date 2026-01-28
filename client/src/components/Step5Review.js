import React, { useState } from 'react';
import axios from 'axios';

function Step5Review({ state, dispatch, onPrev }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const calculateTotalMessages = () => {
    const { numberOfDates, messagesPerDate } = state.messageRules;
    const totalDMs = state.oneOnOneCount + state.groupDmCount;
    return totalDMs * numberOfDates * messagesPerDate;
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const exportData = {
        oneOnOneDMs: state.oneOnOneDMs,
        groupDMs: state.groupDMs,
        messageRules: state.messageRules,
      };

      const response = await axios.post(
        'http://localhost:5000/api/generate-export',
        exportData,
        {
          responseType: 'blob',
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'slack-dm-export.zip');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to generate export');
      console.error('Export error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Step 5 – Review & Generate</h2>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Review your configuration and generate the Slack export
      </p>

      {success && (
        <div className="success-message">
          Export generated and downloaded successfully!
        </div>
      )}

      {error && (
        <div className="error-message" style={{ padding: '15px', background: '#fee', borderRadius: '6px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <div className="review-summary">
        <h2>Summary</h2>
        
        <div className="summary-item">
          <strong>Total DMs:</strong>
          <span>{state.oneOnOneCount + state.groupDmCount}</span>
        </div>
        
        <div className="summary-item">
          <strong>One-on-One DMs:</strong>
          <span>{state.oneOnOneCount}</span>
        </div>
        
        <div className="summary-item">
          <strong>Group DMs:</strong>
          <span>{state.groupDmCount}</span>
        </div>
        
        <div className="summary-item">
          <strong>Total Days:</strong>
          <span>{state.messageRules.numberOfDates}</span>
        </div>
        
        <div className="summary-item">
          <strong>Total Messages:</strong>
          <span>{calculateTotalMessages()}</span>
        </div>
      </div>

      {state.oneOnOneCount > 0 && (
        <div className="dm-list">
          <h3 style={{ marginBottom: '15px', color: '#333' }}>One-on-One DMs</h3>
          {state.oneOnOneDMs.map((dm, index) => (
            <div key={index} className="dm-list-item">
              <strong>DM #{index + 1}:</strong> {dm.channelId} (Users: {dm.userId1}, {dm.userId2})
            </div>
          ))}
        </div>
      )}

      {state.groupDmCount > 0 && (
        <div className="dm-list">
          <h3 style={{ marginBottom: '15px', color: '#333' }}>Group DMs</h3>
          {state.groupDMs.map((groupDM, index) => (
            <div key={index} className="dm-list-item">
              <strong>Group #{index + 1}:</strong> {groupDM.groupName} (Channel: {groupDM.channelId})
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loading">Generating export... Please wait.</div>
      ) : (
        <div className="button-group">
          <button className="btn btn-secondary" onClick={onPrev}>
            Previous
          </button>
          <button className="btn btn-primary" onClick={handleGenerate}>
            Generate & Download Slack Export
          </button>
        </div>
      )}
    </div>
  );
}

export default Step5Review;
