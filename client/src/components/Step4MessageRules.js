import React, { useState } from 'react';

function Step4MessageRules({ state, dispatch, onNext, onPrev }) {
  const [errors, setErrors] = useState({});

  const toggleFields = [
    // TEXT FORMATTING
    'formatBold',
    'formatItalic',
    'formatStrikethrough',
    'formatUnderline',

    // CONTENT TYPES
    'includeEmojis',
    'includeMentions',
    'includeDoubleMentions',
    'includeLinks',
    'includeReactions',
    'includeStickers',
    'includeGifs',
    'includeFilesWithText',
    'includeMultipleFiles',

    // MESSAGE TYPES
    'includeBotMessages',
    'includePinnedMessages',
    'includeThreads',
    'includeThreadReplies',

    // Existing message types kept in the app
    'includeForwardedMessages',
    'includeEditedMessages',
  ];

  const areAllMessageTypesSelected = toggleFields.every((f) => Boolean(state.messageRules[f]));

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

    if (messageRules.includeThreads && messageRules.includeThreadReplies) {
      const v = messageRules.repliesPerMessage;
      if (!Number.isInteger(v) || v < 0) {
        newErrors.repliesPerMessage = 'Replies per Message must be a valid non-negative integer';
      }
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

  const setAllMessageTypes = (enabled) => {
    for (const field of toggleFields) {
      updateRule(field, enabled);
    }
  };

  const Toggle = ({ id, label }) => (
    <div className="toggle-item">
      <label htmlFor={id}>{label}</label>
      <label className="toggle-switch">
        <input
          type="checkbox"
          id={id}
          checked={Boolean(state.messageRules[id])}
          onChange={(e) => updateRule(id, e.target.checked)}
        />
        <span className="toggle-slider"></span>
      </label>
    </div>
  );

  return (
    <div>
      <h2>Step 4 – Message Generation Rules</h2>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Configure message generation settings for all DMs
      </p>

      <div className="toggle-group" style={{ marginBottom: '20px' }}>
        <div className="toggle-item">
          <label htmlFor="selectAllMessageTypes">Select All Message Types</label>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="selectAllMessageTypes"
              checked={areAllMessageTypesSelected}
              onChange={(e) => setAllMessageTypes(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

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

      <div className="form-group">
        <label htmlFor="repliesPerMessage">Replies per Message (threads)</label>
        <input
          id="repliesPerMessage"
          type="number"
          min="0"
          value={Number.isFinite(state.messageRules.repliesPerMessage) ? state.messageRules.repliesPerMessage : 0}
          onChange={(e) => {
            const raw = e.target.value;
            // Avoid NaN getting stuck in state (which can make the input feel "uneditable")
            const next = raw === '' ? 0 : parseInt(raw, 10);
            updateRule('repliesPerMessage', Number.isFinite(next) ? next : 0);
          }}
          className={errors.repliesPerMessage ? 'error' : ''}
        />
        {errors.repliesPerMessage && (
          <div className="error-message">{errors.repliesPerMessage}</div>
        )}
      </div>

      <div className="card" style={{ marginTop: '10px' }}>
        <h3>Text Formatting</h3>
        <div className="toggle-grid">
          <Toggle id="formatBold" label="Bold" />
          <Toggle id="formatItalic" label="Italic" />
          <Toggle id="formatStrikethrough" label="Strikethrough" />
          <Toggle id="formatUnderline" label="Underline" />
        </div>
      </div>

      <div className="card">
        <h3>Content Types</h3>
        <div className="toggle-grid">
          <Toggle id="includeEmojis" label="Emojis" />
          <Toggle id="includeMentions" label="Mentions" />
          <Toggle id="includeDoubleMentions" label="Double mentions" />
          <Toggle id="includeLinks" label="Links" />
          <Toggle id="includeReactions" label="Reactions" />
          <Toggle id="includeStickers" label="Stickers" />
          <Toggle id="includeGifs" label="GIFs" />
          <Toggle id="includeFilesWithText" label="Files with text" />
          <Toggle id="includeMultipleFiles" label="Multiple files in one message" />
        </div>
      </div>

      <div className="card">
        <h3>Message Types</h3>
        <div className="toggle-grid">
          <Toggle id="includeBotMessages" label="Bot messages" />
          <Toggle id="includePinnedMessages" label="Pinned messages" />
          <Toggle id="includeThreads" label="Threaded messages" />
          <Toggle id="includeThreadReplies" label="Replies in threads" />
          <Toggle id="includeForwardedMessages" label="Forwarded messages" />
          <Toggle id="includeEditedMessages" label="Edited messages" />
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
