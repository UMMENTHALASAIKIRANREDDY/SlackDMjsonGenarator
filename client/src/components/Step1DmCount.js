import React, { useState } from 'react';

function Step1DmCount({ state, dispatch, onNext }) {
  const [oneOnOneCount, setOneOnOneCount] = useState(state.oneOnOneCount || 0);
  const [groupDmCount, setGroupDmCount] = useState(state.groupDmCount || 0);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    
    if (oneOnOneCount < 0 || !Number.isInteger(Number(oneOnOneCount))) {
      newErrors.oneOnOneCount = 'Please enter a valid non-negative integer';
    }
    
    if (groupDmCount < 0 || !Number.isInteger(Number(groupDmCount))) {
      newErrors.groupDmCount = 'Please enter a valid non-negative integer';
    }
    
    if (oneOnOneCount === 0 && groupDmCount === 0) {
      newErrors.general = 'Please enter at least one DM count (one-on-one or group)';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      dispatch({
        type: 'SET_DM_COUNTS',
        payload: {
          oneOnOneCount: parseInt(oneOnOneCount, 10),
          groupDmCount: parseInt(groupDmCount, 10),
        },
      });
      onNext();
    }
  };

  return (
    <div>
      <h2>Step 1 – DM Count Selection</h2>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Enter the number of DMs you want to generate
      </p>

      {errors.general && (
        <div className="error-message" style={{ marginBottom: '20px', padding: '10px', background: '#fee', borderRadius: '6px' }}>
          {errors.general}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="oneOnOneCount">Number of One-on-One DMs</label>
        <input
          id="oneOnOneCount"
          type="number"
          min="0"
          value={oneOnOneCount}
          onChange={(e) => setOneOnOneCount(e.target.value)}
          className={errors.oneOnOneCount ? 'error' : ''}
        />
        {errors.oneOnOneCount && (
          <div className="error-message">{errors.oneOnOneCount}</div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="groupDmCount">Number of Group DMs</label>
        <input
          id="groupDmCount"
          type="number"
          min="0"
          value={groupDmCount}
          onChange={(e) => setGroupDmCount(e.target.value)}
          className={errors.groupDmCount ? 'error' : ''}
        />
        {errors.groupDmCount && (
          <div className="error-message">{errors.groupDmCount}</div>
        )}
      </div>

      <div className="button-group">
        <button className="btn btn-primary" onClick={handleNext}>
          Next
        </button>
      </div>
    </div>
  );
}

export default Step1DmCount;
