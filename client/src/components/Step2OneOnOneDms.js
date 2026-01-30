import React, { useState } from 'react';

function Step2OneOnOneDms({ state, dispatch, onNext, onPrev }) {
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    
    state.oneOnOneDMs.forEach((dm, index) => {
      if (!dm.channelId) {
        newErrors[`channelId_${index}`] = 'Channel ID is required';
      } else if (!dm.channelId.startsWith('D')) {
        newErrors[`channelId_${index}`] = 'Channel ID must start with "D"';
      }
      
      if (!dm.userId1) {
        newErrors[`userId1_${index}`] = 'User ID #1 is required';
      }
      
      if (!dm.userId2) {
        newErrors[`userId2_${index}`] = 'User ID #2 is required';
      }
      // Slack supports self-DMs where both user IDs are the same.
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      onNext();
    }
  };

  const updateDm = (index, field, value) => {
    dispatch({
      type: 'UPDATE_ONE_ON_ONE_DM',
      payload: { index, field, value },
    });
  };

  if (state.oneOnOneCount === 0) {
    return (
      <div>
        <h2>Step 2 – One-on-One DM Details</h2>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          No one-on-one DMs to configure. Skipping to next step...
        </p>
        <div className="button-group">
          <button className="btn btn-secondary" onClick={onPrev}>
            Previous
          </button>
          <button className="btn btn-primary" onClick={onNext}>
            Next
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>Step 2 – One-on-One DM Details</h2>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Configure details for each one-on-one DM
      </p>

      {state.oneOnOneDMs.map((dm, index) => (
        <div key={index} className="card">
          <h3>One-on-One DM #{index + 1}</h3>
          
          <div className="form-group">
            <label htmlFor={`channelId_${index}`}>DM Channel ID</label>
            <input
              id={`channelId_${index}`}
              type="text"
              placeholder="e.g. D01PKDLKR39"
              value={dm.channelId}
              onChange={(e) => updateDm(index, 'channelId', e.target.value)}
              className={errors[`channelId_${index}`] ? 'error' : ''}
            />
            {errors[`channelId_${index}`] && (
              <div className="error-message">{errors[`channelId_${index}`]}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor={`userId1_${index}`}>User ID #1</label>
            <input
              id={`userId1_${index}`}
              type="text"
              placeholder="e.g. U01234567"
              value={dm.userId1}
              onChange={(e) => updateDm(index, 'userId1', e.target.value)}
              className={errors[`userId1_${index}`] ? 'error' : ''}
            />
            {errors[`userId1_${index}`] && (
              <div className="error-message">{errors[`userId1_${index}`]}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor={`userId2_${index}`}>User ID #2</label>
            <input
              id={`userId2_${index}`}
              type="text"
              placeholder="e.g. U09876543"
              value={dm.userId2}
              onChange={(e) => updateDm(index, 'userId2', e.target.value)}
              className={errors[`userId2_${index}`] ? 'error' : ''}
            />
            {errors[`userId2_${index}`] && (
              <div className="error-message">{errors[`userId2_${index}`]}</div>
            )}
          </div>
        </div>
      ))}

      <div className="button-group">
        <button className="btn btn-secondary" onClick={onPrev}>
          Previous
        </button>
        <button className="btn btn-primary" onClick={handleNext}>
          Next
        </button>
      </div>
    </div>
  );
}

export default Step2OneOnOneDms;
