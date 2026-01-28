import React, { useState } from 'react';

function Step4MessageRules({ state, dispatch, onNext, onPrev }) {
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    const { messageRules } = state;
    
    if (!messageRules.startDate) {
      newErrors.startDate = 'Start Date is required';
    }
    
    if (!messageRules.numberOfDates || messageRules.numberOfDates < 1) {
      newErrors.numberOfDates = 'Number of Dates must be at least 1';
    }
    
    if (!messageRules.messagesPerDate || messageRules.messagesPerDate < 1) {
      newErrors.messagesPerDate = 'Messages per Date must be at least 1';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      onNext();
    }
  };

  const updateRule = (field, value) => {
    dispatch({
      type: 'UPDATE_MESSAGE_RULES',
      payload: { field, value },
    });
  };

  return (
    <div>
      <h2>Step 4 – Message Generation Rules</h2>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Configure message generation settings for all DMs
      </p>

      <div className="form-group">
        <label htmlFor="startDate">Start Date</label>
        <input
          id="startDate"
          type="date"
          value={state.messageRules.startDate}
          onChange={(e) => updateRule('startDate', e.target.value)}
          className={errors.startDate ? 'error' : ''}
        />
        {errors.startDate && (
          <div className="error-message">{errors.startDate}</div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="numberOfDates">Number of Dates (days)</label>
        <input
          id="numberOfDates"
          type="number"
          min="1"
          value={state.messageRules.numberOfDates}
          onChange={(e) => updateRule('numberOfDates', parseInt(e.target.value, 10))}
          className={errors.numberOfDates ? 'error' : ''}
        />
        {errors.numberOfDates && (
          <div className="error-message">{errors.numberOfDates}</div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="messagesPerDate">Messages per Date</label>
        <input
          id="messagesPerDate"
          type="number"
          min="1"
          value={state.messageRules.messagesPerDate}
          onChange={(e) => updateRule('messagesPerDate', parseInt(e.target.value, 10))}
          className={errors.messagesPerDate ? 'error' : ''}
        />
        {errors.messagesPerDate && (
          <div className="error-message">{errors.messagesPerDate}</div>
        )}
      </div>

      <div className="toggle-group">
        <div className="toggle-item">
          <label htmlFor="includeMentions">Include mentions</label>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="includeMentions"
              checked={state.messageRules.includeMentions}
              onChange={(e) => updateRule('includeMentions', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="toggle-item">
          <label htmlFor="includeDoubleMentions">Include double mentions</label>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="includeDoubleMentions"
              checked={state.messageRules.includeDoubleMentions}
              onChange={(e) => updateRule('includeDoubleMentions', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="toggle-item">
          <label htmlFor="includeReactions">Include reactions</label>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="includeReactions"
              checked={state.messageRules.includeReactions}
              onChange={(e) => updateRule('includeReactions', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="toggle-item">
          <label htmlFor="includeFileUploads">Include file uploads</label>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="includeFileUploads"
              checked={state.messageRules.includeFileUploads}
              onChange={(e) => updateRule('includeFileUploads', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="toggle-item">
          <label htmlFor="includeThreads">Include threads</label>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="includeThreads"
              checked={state.messageRules.includeThreads}
              onChange={(e) => updateRule('includeThreads', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="toggle-item">
          <label htmlFor="includeForwardedMessages">Include forwarded messages</label>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="includeForwardedMessages"
              checked={state.messageRules.includeForwardedMessages}
              onChange={(e) => updateRule('includeForwardedMessages', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="toggle-item">
          <label htmlFor="includeEditedMessages">Include edited messages</label>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="includeEditedMessages"
              checked={state.messageRules.includeEditedMessages}
              onChange={(e) => updateRule('includeEditedMessages', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

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

export default Step4MessageRules;
