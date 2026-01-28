const fs = require('fs-extra');
const path = require('path');

/**
 * Generates a Slack-compatible DM export structure
 */
async function generateSlackExport(exportData, exportDir) {
  const { oneOnOneDMs, groupDMs, messageRules } = exportData;
  
  // Generate dms.json metadata
  const dmsMetadata = oneOnOneDMs.map(dm => ({
    id: dm.channelId,
    created: Math.floor(Date.now() / 1000),
    members: [dm.userId1, dm.userId2]
  }));
  await fs.writeJson(
    path.join(exportDir, 'dms.json'),
    dmsMetadata,
    { spaces: 2 }
  );
  
  // Generate mpims.json metadata
  const mpimsMetadata = groupDMs.map(groupDM => {
    const created = Math.floor(Date.now() / 1000);
    const members = [groupDM.creatorUserId, ...groupDM.memberUserIds.split(',').map(id => id.trim())];
    
    return {
      id: groupDM.channelId,
      name: groupDM.groupName,
      created: created,
      creator: groupDM.creatorUserId,
      is_archived: false,
      members: members,
      topic: {
        value: '',
        creator: groupDM.creatorUserId,
        last_set: created
      },
      purpose: {
        value: 'Group Channel From ' + groupDM.creatorUserId,
        creator: groupDM.creatorUserId,
        last_set: created
      }
    };
  });
  await fs.writeJson(
    path.join(exportDir, 'mpims.json'),
    mpimsMetadata,
    { spaces: 2 }
  );
  
  // Process one-on-one DMs - create folder directly in exportDir
  for (const dm of oneOnOneDMs) {
    const channelDir = path.join(exportDir, dm.channelId);
    await fs.ensureDir(channelDir);
    
    // Generate messages and split by date
    const messages = generateMessages(dm, messageRules);
    const messagesByDate = groupMessagesByDate(messages);
    
    // Create date-named JSON files
    for (const [date, dateMessages] of Object.entries(messagesByDate)) {
      await fs.writeJson(
        path.join(channelDir, `${date}.json`),
        dateMessages,
        { spaces: 2 }
      );
    }
  }
  
  // Process group DMs - create folder directly in exportDir
  for (const groupDM of groupDMs) {
    // Use group name as folder name, directly in exportDir
    const groupDir = path.join(exportDir, groupDM.groupName);
    await fs.ensureDir(groupDir);
    
    // Generate messages and split by date
    const messages = generateGroupMessages(groupDM, messageRules);
    const messagesByDate = groupMessagesByDate(messages);
    
    // Create date-named JSON files
    for (const [date, dateMessages] of Object.entries(messagesByDate)) {
      await fs.writeJson(
        path.join(groupDir, `${date}.json`),
        dateMessages,
        { spaces: 2 }
      );
    }
  }
}

/**
 * Groups messages by date (YYYY-MM-DD format)
 */
function groupMessagesByDate(messages) {
  const messagesByDate = {};
  
  for (const message of messages) {
    const timestamp = parseFloat(message.ts);
    const date = new Date(timestamp * 1000);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    if (!messagesByDate[dateStr]) {
      messagesByDate[dateStr] = [];
    }
    messagesByDate[dateStr].push(message);
  }
  
  return messagesByDate;
}

/**
 * Generates messages for a one-on-one DM
 */
function generateMessages(dm, messageRules) {
  const { startDate, numberOfDates, messagesPerDate, includeMentions, includeDoubleMentions, includeReactions, includeFileUploads, includeThreads, includeForwardedMessages, includeEditedMessages } = messageRules;
  
  const messages = [];
  const start = new Date(startDate);
  const userIds = [dm.userId1, dm.userId2];
  
  for (let day = 0; day < numberOfDates; day++) {
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() + day);
    
    for (let msgIndex = 0; msgIndex < messagesPerDate; msgIndex++) {
      const timestamp = currentDate.getTime() / 1000 + (msgIndex * 3600); // Spread messages throughout the day
      const senderIndex = Math.floor(Math.random() * 2);
      const senderId = userIds[senderIndex];
      const otherUserId = userIds[1 - senderIndex];
      
      const message = {
        type: 'message',
        user: senderId,
        text: generateMessageText(includeMentions, includeDoubleMentions, otherUserId),
        ts: timestamp.toString(),
      };
      
      // Add reactions if enabled
      if (includeReactions && Math.random() > 0.7) {
        message.reactions = generateReactions(userIds);
      }
      
      // Add file upload if enabled
      if (includeFileUploads && Math.random() > 0.8) {
        message.files = generateFileUpload();
      }
      
      // Add thread if enabled
      if (includeThreads && Math.random() > 0.85) {
        message.thread_ts = timestamp.toString();
        message.reply_count = Math.floor(Math.random() * 5) + 1;
      }
      
      // Add forwarded message if enabled
      if (includeForwardedMessages && Math.random() > 0.9) {
        message.subtype = 'message_changed';
        message.message = {
          type: 'message',
          user: otherUserId,
          text: 'Forwarded message content',
          ts: (timestamp - 86400).toString()
        };
      }
      
      // Add edited message if enabled
      if (includeEditedMessages && Math.random() > 0.75) {
        message.edited = {
          user: senderId,
          ts: (timestamp + 60).toString()
        };
        message.text += ' (edited)';
      }
      
      messages.push(message);
    }
  }
  
  // Sort messages by timestamp
  messages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
  
  return messages;
}

/**
 * Generates messages for a group DM
 */
function generateGroupMessages(groupDM, messageRules) {
  const { startDate, numberOfDates, messagesPerDate, includeMentions, includeDoubleMentions, includeReactions, includeFileUploads, includeThreads, includeForwardedMessages, includeEditedMessages } = messageRules;
  
  const messages = [];
  const start = new Date(startDate);
  const allUserIds = [groupDM.creatorUserId, ...groupDM.memberUserIds.split(',').map(id => id.trim())];
  
  for (let day = 0; day < numberOfDates; day++) {
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() + day);
    
    for (let msgIndex = 0; msgIndex < messagesPerDate; msgIndex++) {
      const timestamp = currentDate.getTime() / 1000 + (msgIndex * 3600);
      const senderId = allUserIds[Math.floor(Math.random() * allUserIds.length)];
      const mentionedUser = allUserIds[Math.floor(Math.random() * allUserIds.length)];
      
      const message = {
        type: 'message',
        user: senderId,
        text: generateMessageText(includeMentions, includeDoubleMentions, mentionedUser),
        ts: timestamp.toString(),
      };
      
      // Add reactions if enabled
      if (includeReactions && Math.random() > 0.7) {
        message.reactions = generateReactions(allUserIds);
      }
      
      // Add file upload if enabled
      if (includeFileUploads && Math.random() > 0.8) {
        message.files = generateFileUpload();
      }
      
      // Add thread if enabled
      if (includeThreads && Math.random() > 0.85) {
        message.thread_ts = timestamp.toString();
        message.reply_count = Math.floor(Math.random() * 5) + 1;
      }
      
      // Add forwarded message if enabled
      if (includeForwardedMessages && Math.random() > 0.9) {
        message.subtype = 'message_changed';
        message.message = {
          type: 'message',
          user: allUserIds[Math.floor(Math.random() * allUserIds.length)],
          text: 'Forwarded message content',
          ts: (timestamp - 86400).toString()
        };
      }
      
      // Add edited message if enabled
      if (includeEditedMessages && Math.random() > 0.75) {
        message.edited = {
          user: senderId,
          ts: (timestamp + 60).toString()
        };
        message.text += ' (edited)';
      }
      
      messages.push(message);
    }
  }
  
  // Sort messages by timestamp
  messages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
  
  return messages;
}

/**
 * Generates message text with optional mentions
 */
function generateMessageText(includeMentions, includeDoubleMentions, userId) {
  const sampleTexts = [
    'Hey, how are you doing?',
    'Just checking in!',
    'Thanks for the update.',
    'That sounds great!',
    'Let me know when you\'re ready.',
    'Can we schedule a meeting?',
    'I\'ll send that over shortly.',
  ];
  
  let text = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
  
  if (includeMentions && Math.random() > 0.5) {
    if (includeDoubleMentions && Math.random() > 0.5) {
      text = `<@${userId}> <@${userId}> ${text}`;
    } else {
      text = `<@${userId}> ${text}`;
    }
  }
  
  return text;
}

/**
 * Generates reactions for messages
 */
function generateReactions(userIds) {
  const emojis = ['thumbsup', 'heart', 'smile', 'clap', 'fire', 'rocket'];
  const numReactions = Math.floor(Math.random() * 3) + 1;
  const reactions = [];
  
  for (let i = 0; i < numReactions; i++) {
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const existingReaction = reactions.find(r => r.name === emoji);
    
    if (existingReaction) {
      existingReaction.count++;
      existingReaction.users.push(userIds[Math.floor(Math.random() * userIds.length)]);
    } else {
      reactions.push({
        name: emoji,
        count: 1,
        users: [userIds[Math.floor(Math.random() * userIds.length)]]
      });
    }
  }
  
  return reactions;
}

/**
 * Generates a file upload object
 */
function generateFileUpload() {
  const fileTypes = ['image', 'document', 'pdf'];
  const fileType = fileTypes[Math.floor(Math.random() * fileTypes.length)];
  
  return [{
    id: `F${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    name: `file_${Date.now()}.${fileType === 'image' ? 'png' : 'pdf'}`,
    mimetype: fileType === 'image' ? 'image/png' : 'application/pdf',
    filetype: fileType,
    size: Math.floor(Math.random() * 1000000) + 10000,
    url_private: `https://files.slack.com/files-pri/T1234567890-F${Math.random().toString(36).substr(2, 9).toUpperCase()}/file`,
    url_private_download: `https://files.slack.com/files-pri/T1234567890-F${Math.random().toString(36).substr(2, 9).toUpperCase()}/file/download`
  }];
}

module.exports = { generateSlackExport };
