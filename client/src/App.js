import React, { useReducer } from 'react';
import './App.css';
import Step1DmCount from './components/Step1DmCount';
import Step2OneOnOneDms from './components/Step2OneOnOneDms';
import Step3GroupDms from './components/Step3GroupDms';
import Step4MessageRules from './components/Step4MessageRules';
import Step5Review from './components/Step5Review';

const initialState = {
  currentStep: 1,
  oneOnOneCount: 0,
  groupDmCount: 0,
  oneOnOneDMs: [],
  groupDMs: [],
  messageRules: {
    startDate: '',
    numberOfDates: 1,
    messagesPerDate: 10,
    repliesPerMessage: 2,
    // Master controls (Step 4 toggles)
    formatBold: false,
    formatItalic: false,
    formatStrikethrough: false,
    formatUnderline: false,

    includeEmojis: false,
    includeMentions: false,
    includeDoubleMentions: false,
    includeLinks: false,
    includeReactions: false,
    includeStickers: false,
    includeGifs: false,
    includeFilesWithText: false,
    includeMultipleFiles: false,

    includeBotMessages: false,
    includePinnedMessages: false,
    includeThreads: false, // threaded messages
    includeThreadReplies: false,
    includeFileUploads: false, // legacy/back-compat (kept)
    includeForwardedMessages: false,
    includeEditedMessages: false,
  },
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };
    case 'SET_DM_COUNTS':
      return {
        ...state,
        oneOnOneCount: action.payload.oneOnOneCount,
        groupDmCount: action.payload.groupDmCount,
        oneOnOneDMs: Array(action.payload.oneOnOneCount).fill(null).map(() => ({
          channelId: '',
          userId1: '',
          userId2: '',
        })),
        groupDMs: Array(action.payload.groupDmCount).fill(null).map(() => ({
          groupName: '',
          channelId: '',
          creatorUserId: '',
          memberUserIds: '',
        })),
      };
    case 'UPDATE_ONE_ON_ONE_DM':
      const updatedOneOnOne = [...state.oneOnOneDMs];
      updatedOneOnOne[action.payload.index] = {
        ...updatedOneOnOne[action.payload.index],
        [action.payload.field]: action.payload.value,
      };
      return { ...state, oneOnOneDMs: updatedOneOnOne };
    case 'UPDATE_GROUP_DM':
      const updatedGroup = [...state.groupDMs];
      updatedGroup[action.payload.index] = {
        ...updatedGroup[action.payload.index],
        [action.payload.field]: action.payload.value,
      };
      return { ...state, groupDMs: updatedGroup };
    case 'UPDATE_MESSAGE_RULES':
      return {
        ...state,
        messageRules: {
          ...state.messageRules,
          [action.payload.field]: action.payload.value,
        },
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const nextStep = () => {
    if (state.currentStep < 5) {
      dispatch({ type: 'SET_STEP', payload: state.currentStep + 1 });
    }
  };

  const prevStep = () => {
    if (state.currentStep > 1) {
      dispatch({ type: 'SET_STEP', payload: state.currentStep - 1 });
    }
  };

  const renderStep = () => {
    switch (state.currentStep) {
      case 1:
        return <Step1DmCount state={state} dispatch={dispatch} onNext={nextStep} />;
      case 2:
        return <Step2OneOnOneDms state={state} dispatch={dispatch} onNext={nextStep} onPrev={prevStep} />;
      case 3:
        return <Step3GroupDms state={state} dispatch={dispatch} onNext={nextStep} onPrev={prevStep} />;
      case 4:
        return <Step4MessageRules state={state} dispatch={dispatch} onNext={nextStep} onPrev={prevStep} />;
      case 5:
        return <Step5Review state={state} dispatch={dispatch} onPrev={prevStep} />;
      default:
        return null;
    }
  };

  return (
    <div className="App">
      <div className="wizard-container">
        <div className="wizard-header">
          <h1>Slack DM Export Generator</h1>
          <div className="step-indicator">
            <div className={`step ${state.currentStep >= 1 ? 'active' : ''}`}>1</div>
            <div className={`step ${state.currentStep >= 2 ? 'active' : ''}`}>2</div>
            <div className={`step ${state.currentStep >= 3 ? 'active' : ''}`}>3</div>
            <div className={`step ${state.currentStep >= 4 ? 'active' : ''}`}>4</div>
            <div className={`step ${state.currentStep >= 5 ? 'active' : ''}`}>5</div>
          </div>
        </div>
        <div className="wizard-content">
          {renderStep()}
        </div>
        <div className="developer-credit">
          Developed by Cloudfuze 
        </div>
      </div>
    </div>
  );
}

export default App;
