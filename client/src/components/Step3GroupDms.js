import React, { useState } from 'react';

function Step3GroupDms({ state, dispatch, onNext, onPrev }) {
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    
    state.groupDMs.forEach((groupDM, index) => {
      if (!groupDM.groupName) {
        newErrors[`groupName_${index}`] = 'Group Name is required';
      }
      
      if (!groupDM.channelId) {
        newErrors[`channelId_${index}`] = 'Channel ID is required';
      } else if (!groupDM.channelId.startsWith('C')) {
        newErrors[`channelId_${index}`] = 'Channel ID must start with "C"';
      }
      
      if (!groupDM.creatorUserId) {
        newErrors[`creatorUserId_${index}`] = 'Creator User ID is required';
      }
      
      if (!groupDM.memberUserIds) {
        newErrors[`memberUserIds_${index}`] = 'Member User IDs are required';
      } else {
        const memberIds = groupDM.memberUserIds.split(',').map(id => id.trim()).filter(id => id);
        if (memberIds.length < 3) {
          newErrors[`memberUserIds_${index}`] = 'Minimum 3 member user IDs required (comma-separated)';
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      onNext();
    }
  };

  const updateGroupDm = (index, field, value) => {
    dispatch({
      type: 'UPDATE_GROUP_DM',
      payload: { index, field, value },
    });
  };

  if (state.groupDmCount === 0) {
    return (
      <div>
        <h2>Step 3 – Group DM Details</h2>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          No group DMs to configure. Skipping to next step...
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
      <h2>Step 3 – Group DM Details</h2>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Configure details for each group DM
      </p>

      {state.groupDMs.map((groupDM, index) => (
        <div key={index} className="card">
          <h3>Group DM #{index + 1}</h3>
          
          <div className="form-group">
            <label htmlFor={`groupName_${index}`}>Group Name (used as folder name)</label>
            <input
              id={`groupName_${index}`}
              type="text"
              placeholder="e.g. Project Team"
              value={groupDM.groupName}
              onChange={(e) => updateGroupDm(index, 'groupName', e.target.value)}
              className={errors[`groupName_${index}`] ? 'error' : ''}
            />
            {errors[`groupName_${index}`] && (
              <div className="error-message">{errors[`groupName_${index}`]}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor={`channelId_${index}`}>Channel ID</label>
            <input
              id={`channelId_${index}`}
              type="text"
              placeholder="e.g. C0A1Y0LLTDX"
              value={groupDM.channelId}
              onChange={(e) => updateGroupDm(index, 'channelId', e.target.value)}
              className={errors[`channelId_${index}`] ? 'error' : ''}
            />
            {errors[`channelId_${index}`] && (
              <div className="error-message">{errors[`channelId_${index}`]}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor={`creatorUserId_${index}`}>Creator User ID</label>
            <input
              id={`creatorUserId_${index}`}
              type="text"
              placeholder="e.g. U01234567"
              value={groupDM.creatorUserId}
              onChange={(e) => updateGroupDm(index, 'creatorUserId', e.target.value)}
              className={errors[`creatorUserId_${index}`] ? 'error' : ''}
            />
            {errors[`creatorUserId_${index}`] && (
              <div className="error-message">{errors[`creatorUserId_${index}`]}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor={`memberUserIds_${index}`}>Member User IDs (comma-separated, minimum 3)</label>
            <input
              id={`memberUserIds_${index}`}
              type="text"
              placeholder="e.g. U01234567, U09876543, U05555555"
              value={groupDM.memberUserIds}
              onChange={(e) => updateGroupDm(index, 'memberUserIds', e.target.value)}
              className={errors[`memberUserIds_${index}`] ? 'error' : ''}
            />
            {errors[`memberUserIds_${index}`] && (
              <div className="error-message">{errors[`memberUserIds_${index}`]}</div>
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

export default Step3GroupDms;
