const fs = require('fs-extra');
const path = require('path');

const DEFAULT_TEAM_ID = 'T01QQ0VG7EU';

function clientMsgId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function randomBlockId() {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let id = '';
  for (let i = 0; i < 5; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function buildUserProfile(userId) {
  const hash = Math.random().toString(36).slice(2, 14);
  return {
    avatar_hash: `g${hash}`,
    image_72: `https://secure.gravatar.com/avatar/${hash}.jpg?s=72&d=https%3A%2F%2Fa.slack-edge.com%2Fdf10d%2Fimg%2Favatars%2Fava_0003-72.png`,
    first_name: userId ? userId.slice(0, 4) : 'User',
    real_name: userId || 'User',
    display_name: userId ? userId.toLowerCase().slice(0, 6) : 'user',
    team: DEFAULT_TEAM_ID,
    name: userId ? userId.toLowerCase().slice(0, 6) : 'user',
    is_restricted: false,
    is_ultra_restricted: false,
  };
}

function ensureBlockIds(blocks) {
  if (!Array.isArray(blocks)) return;
  for (const block of blocks) {
    if (block && block.type === 'rich_text' && !block.block_id) {
      block.block_id = randomBlockId();
    }
  }
}

/**
 * Generates a Slack-compatible DM export structure
 */
async function generateSlackExport(exportData, exportDir) {
  const { oneOnOneDMs, groupDMs, messageRules } = exportData;
  
  // ==============================
  // HARD DATE SAFETY RULE (MANDATORY)
  // ==============================
  // numberOfDates = N → EXACTLY N date files must exist. Message/reply/file count MUST NOT affect date creation.
  // If generatedDateFiles !== numberOfDates → Abort generation and throw.
  const dateList = generateDateList(messageRules.startDate, messageRules.numberOfDates);
  if (dateList.length !== messageRules.numberOfDates) {
    throw new Error(`Date generation error: expected ${messageRules.numberOfDates} dates, got ${dateList.length}. Aborting.`);
  }
  const dateEntries = dateList.map((dateStr) => ({
    dateStr,
    dayStartTs: parseDateToDayStartTs(dateStr),
  }));

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
    // Creator must always be included, but never duplicated (Slack requires unique members)
    const rawMembers = [
      groupDM.creatorUserId,
      ...groupDM.memberUserIds.split(',').map((id) => id.trim()),
    ].filter(Boolean);
    const members = Array.from(new Set(rawMembers));
    
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
    
    // Generate messages per date (no deriving dates from timestamps)
    const messagesByDate = generateMessages(dm, messageRules, dateEntries);

    // Create EXACTLY N date-named JSON files (only from dateList)
    for (const { dateStr } of dateEntries) {
      await fs.writeJson(
        path.join(channelDir, `${dateStr}.json`),
        messagesByDate[dateStr] || [],
        { spaces: 2 }
      );
    }

    // HARD ASSERTION: generatedDateFiles must equal numberOfDates (no extra date files)
    const files = await fs.readdir(channelDir);
    const dateFiles = files.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
    if (dateFiles.length !== messageRules.numberOfDates) {
      throw new Error(`Date file count mismatch for ${dm.channelId}: generated ${dateFiles.length}, expected ${messageRules.numberOfDates}. Aborting ZIP creation.`);
    }
  }

  // Process group DMs - create folder directly in exportDir
  for (const groupDM of groupDMs) {
    // Use group name as folder name, directly in exportDir
    const groupDir = path.join(exportDir, groupDM.groupName);
    await fs.ensureDir(groupDir);
    
    // Generate messages per date (no deriving dates from timestamps)
    const messagesByDate = generateGroupMessages(groupDM, messageRules, dateEntries);

    // Create EXACTLY N date-named JSON files (only from dateList)
    for (const { dateStr } of dateEntries) {
      await fs.writeJson(
        path.join(groupDir, `${dateStr}.json`),
        messagesByDate[dateStr] || [],
        { spaces: 2 }
      );
    }

    // HARD ASSERTION: generatedDateFiles must equal numberOfDates (no extra date files)
    const files = await fs.readdir(groupDir);
    const dateFiles = files.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
    if (dateFiles.length !== messageRules.numberOfDates) {
      throw new Error(`Date file count mismatch for ${groupDM.groupName}: generated ${dateFiles.length}, expected ${messageRules.numberOfDates}. Aborting ZIP creation.`);
    }
  }
}

/**
 * Groups messages by date (YYYY-MM-DD format)
 */
function generateDateList(startDate, numberOfDates) {
  if (!startDate) {
    throw new Error('Date generation error: startDate is required');
  }
  if (!Number.isInteger(numberOfDates) || numberOfDates < 1) {
    throw new Error(`Date generation error: numberOfDates must be >= 1 (got ${numberOfDates})`);
  }

  // Parse YYYY-MM-DD deterministically and generate dates in UTC to avoid timezone drift.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate);
  if (!m) {
    throw new Error(`Date generation error: invalid startDate format "${startDate}" (expected YYYY-MM-DD)`);
  }
  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12
  const day = Number(m[3]);   // 1-31

  const startUtcMs = Date.UTC(year, month - 1, day);
  const oneDayMs = 24 * 60 * 60 * 1000;

  const dates = [];
  for (let i = 0; i < numberOfDates; i++) {
    const dateStr = new Date(startUtcMs + i * oneDayMs).toISOString().slice(0, 10); // YYYY-MM-DD
    dates.push(dateStr);
  }

  // Guard against any unexpected duplication
  const unique = new Set(dates);
  if (unique.size !== numberOfDates) {
    throw new Error(`Date generation error: produced ${unique.size} unique dates, expected ${numberOfDates}`);
  }

  return dates;
}

function parseDateToDayStartTs(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) {
    throw new Error(`Date generation error: invalid date "${dateStr}" (expected YYYY-MM-DD)`);
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return Math.floor(Date.UTC(year, month - 1, day) / 1000);
}

function groupMessagesByDate(messages, allowedDateList) {
  const allowed = Array.isArray(allowedDateList) ? allowedDateList : [];
  const allowedSet = new Set(allowed);
  const messagesByDate = {};

  // Initialize all allowed dates so file creation is controlled ONLY by numberOfDates
  for (const date of allowed) {
    messagesByDate[date] = [];
  }

  for (const message of messages) {
    const timestamp = parseFloat(message.ts);
    const dateStr = new Date(timestamp * 1000).toISOString().slice(0, 10); // YYYY-MM-DD in UTC

    // Strict enforcement: never allow messages to create implicit dates/files
    if (!allowedSet.has(dateStr)) {
      throw new Error(
        `Date overflow: message ts=${message.ts} resolved to ${dateStr}, outside allowed dates [${allowed.join(', ')}]`
      );
    }

    messagesByDate[dateStr].push(message);
  }

  // Validation guard: never allow more than N unique date buckets
  const bucketCount = Object.keys(messagesByDate).length;
  if (bucketCount > allowed.length) {
    throw new Error(`Date bucket overflow: generated ${bucketCount} buckets, expected ${allowed.length}`);
  }

  return messagesByDate;
}

/**
 * Generates messages for a one-on-one DM
 */
function generateMessages(dm, messageRules, dateEntries) {
  const participantUserIds = uniquePreserveOrder([dm.userId1, dm.userId2].filter(Boolean));

  return generateConversationMessagesByDate({
    conversationId: dm.channelId,
    participantUserIds,
    messageRules,
    dateEntries,
  });
}

/**
 * Generates messages for a group DM
 */
function generateGroupMessages(groupDM, messageRules, dateEntries) {
  const participantUserIds = uniquePreserveOrder([
    groupDM.creatorUserId,
    ...splitUserIds(groupDM.memberUserIds),
  ].filter(Boolean));

  return generateConversationMessagesByDate({
    conversationId: groupDM.channelId,
    participantUserIds,
    messageRules,
    dateEntries,
  });
}

function splitUserIds(raw) {
  return String(raw || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function uniquePreserveOrder(values) {
  const out = [];
  const seen = new Set();
  for (const v of values) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function chance(p) {
  return Math.random() < p;
}

function getRepliesPerParent(messageRules) {
  const candidates = [
    messageRules?.repliesPerMessage,
    // Back-compat / older naming variants (keep as fallback)
    messageRules?.repliesPerThread,
    messageRules?.threadRepliesPerMessage,
    messageRules?.threadReplyCount,
    messageRules?.repliesCount,
  ];

  for (const v of candidates) {
    if (Number.isInteger(v) && v >= 0) return v;
  }
  return 2; // safe default when threads are enabled
}

/**
 * Build ordered list of coverage requirements so each enabled type gets at least one message (round-robin by msgIndex).
 */
function buildCoverageRequirements(messageRules, flags) {
  const req = [];
  const {
    formatBold, formatItalic, formatStrikethrough, formatUnderline,
    includeEmojis, includeMentions, includeDoubleMentions, includeLinks, includeReactions,
    includeStickers, includeGifs, includeFilesWithText, includeMultipleFiles,
    includeBotMessages, includePinnedMessages, includeThreads, includeThreadReplies,
    includeForwardedMessages, includeEditedMessages,
    allowAnyFiles, enabledStyles,
  } = flags;

  if (includeBotMessages) req.push('bot');
  if (includePinnedMessages) req.push('pinned');
  if (allowAnyFiles && includeMultipleFiles) req.push('multiFile');
  if (allowAnyFiles && includeStickers) req.push('stickerFile');
  if (allowAnyFiles && includeGifs) req.push('gifFile');
  if (allowAnyFiles && includeFilesWithText) req.push('filesWithText');
  if (allowAnyFiles) req.push('fileOnly'); // at least one file-only message when files enabled
  if (includeForwardedMessages) req.push('forwarded');
  if (includeEditedMessages) req.push('edited');
  if (includeReactions) req.push('reactions');
  if (includeEmojis) req.push('emojiOnly');
  if (includeLinks) req.push('link');
  if (includeEmojis) req.push('emoji');
  if (includeMentions) req.push('mentionSingle');
  if (includeMentions && includeDoubleMentions) req.push('mentionDouble');
  if (formatBold) req.push('bold');
  if (formatItalic) req.push('italic');
  if (formatStrikethrough) req.push('strike');
  if (formatUnderline) req.push('underline');

  return req;
}

/**
 * Verify every enabled message type produced at least one message (or reply). If any missing, throw before ZIP.
 */
function ensureCoverage(messages, messageRules) {
  const missing = [];
  const {
    formatBold, formatItalic, formatStrikethrough, formatUnderline,
    includeEmojis, includeMentions, includeDoubleMentions, includeLinks, includeReactions,
    includeStickers, includeGifs, includeFilesWithText, includeMultipleFiles,
    includeBotMessages, includePinnedMessages, includeThreads, includeThreadReplies,
    includeForwardedMessages, includeEditedMessages,
  } = messageRules;

  function hasStyle(msg, styleKey) {
    if (!msg.blocks || !Array.isArray(msg.blocks)) return false;
    for (const block of msg.blocks) {
      if (block.type !== 'rich_text' || !Array.isArray(block.elements)) continue;
      for (const el of block.elements) {
        if (el.type === 'rich_text_section' && Array.isArray(el.elements)) {
          for (const sub of el.elements) {
            if (sub.type === 'text' && sub.style && sub.style[styleKey]) return true;
          }
        }
      }
    }
    return false;
  }
  function hasElement(msg, type, extra) {
    if (!msg.blocks || !Array.isArray(msg.blocks)) return false;
    for (const block of msg.blocks) {
      if (block.type !== 'rich_text' || !Array.isArray(block.elements)) continue;
      for (const el of block.elements) {
        if (el.type === 'rich_text_section' && Array.isArray(el.elements)) {
          for (const sub of el.elements) {
            if (sub.type === type) {
              if (!extra) return true;
              if (extra === 'user' && sub.user_id) return true;
              if (extra === 'link' && sub.url) return true;
              if (extra === 'emoji' && sub.name) return true;
            }
          }
        }
      }
    }
    if (msg.attachments && Array.isArray(msg.attachments)) {
      for (const att of msg.attachments) {
        if (att.blocks && Array.isArray(att.blocks)) {
          for (const b of att.blocks) {
            if (b.type === 'rich_text' && Array.isArray(b.elements)) {
              for (const sec of b.elements) {
                if (sec.elements) {
                  for (const sub of sec.elements) {
                    if (sub.type === type) return true;
                  }
                }
              }
            }
          }
        }
      }
    }
    return false;
  }
  function hasFileKind(msg, kind) {
    if (!msg.files || !Array.isArray(msg.files)) return false;
    return msg.files.some((f) => f.filetype === (kind === 'gif' ? 'gif' : 'png') && (kind !== 'sticker' || (f.title || f.name || '').toLowerCase().includes('sticker')));
  }
  function hasSticker(msg) {
    if (!msg.files || !Array.isArray(msg.files)) return false;
    const stickerNames = ['sticker', 'ステッカー'];
    return msg.files.some((f) => stickerNames.some((s) => (f.name || f.title || '').toLowerCase().includes(s)));
  }
  function hasGif(msg) {
    if (!msg.files || !Array.isArray(msg.files)) return false;
    return msg.files.some((f) => (f.filetype || f.mimetype || '').includes('gif') || (f.name || f.title || '').toLowerCase().endsWith('.gif'));
  }

  const flat = Array.isArray(messages) ? messages : [];
  if (formatBold && !flat.some((m) => hasStyle(m, 'bold'))) missing.push('bold');
  if (formatItalic && !flat.some((m) => hasStyle(m, 'italic'))) missing.push('italic');
  if (formatStrikethrough && !flat.some((m) => hasStyle(m, 'strike'))) missing.push('strikethrough');
  if (formatUnderline && !flat.some((m) => hasStyle(m, 'underline'))) missing.push('underline');
  if (includeEmojis && !flat.some((m) => hasElement(m, 'emoji'))) missing.push('emoji');
  if (includeMentions && !flat.some((m) => hasElement(m, 'user', 'user'))) missing.push('mention');
  if (includeLinks && !flat.some((m) => hasElement(m, 'link', 'link'))) missing.push('link');
  if (includeReactions && !flat.some((m) => m.reactions && Array.isArray(m.reactions) && m.reactions.length > 0)) missing.push('reactions');
  if (includeStickers && !flat.some((m) => hasSticker(m) || (m.files && m.files.some((f) => (f.pretty_type || f.name || '').toLowerCase().includes('sticker'))))) missing.push('sticker');
  if (includeGifs && !flat.some((m) => hasGif(m))) missing.push('gif');
  if (includeFilesWithText && !flat.some((m) => m.files && m.files.length > 0 && m.text && m.text.trim().length > 0)) missing.push('filesWithText');
  if (includeMultipleFiles && !flat.some((m) => m.files && m.files.length >= 2)) missing.push('multipleFiles');
  if (includeBotMessages && !flat.some((m) => m.subtype === 'bot_message')) missing.push('bot_message');
  if (includePinnedMessages && !flat.some((m) => m.is_pinned === true)) missing.push('pinned');
  if (includeThreads && includeThreadReplies && !flat.some((m) => m.reply_count != null && m.reply_count > 0)) missing.push('thread_replies');
  if (includeForwardedMessages && !flat.some((m) => m.attachments && m.attachments.length > 0)) missing.push('forwarded');
  if (includeEditedMessages && !flat.some((m) => m.edited)) missing.push('edited');

  if (missing.length > 0) {
    throw new Error(`Coverage check failed: enabled types produced no data: ${missing.join(', ')}. Aborting ZIP creation.`);
  }
}

function generateConversationMessagesByDate({ conversationId, participantUserIds, messageRules, dateEntries }) {
  const {
    messagesPerDate,

    // Formatting toggles
    formatBold,
    formatItalic,
    formatStrikethrough,
    formatUnderline,

    // Content toggles
    includeEmojis,
    includeMentions,
    includeDoubleMentions,
    includeLinks,
    includeReactions,
    includeStickers,
    includeGifs,
    includeFilesWithText,
    includeMultipleFiles,

    // Message type toggles
    includeBotMessages,
    includePinnedMessages,
    includeThreads,
    includeThreadReplies,

    // Existing message types kept
    includeFileUploads, // legacy/back-compat
    includeForwardedMessages,
    includeEditedMessages,
  } = messageRules;

  const enabledStyles = [];
  if (formatBold) enabledStyles.push('bold');
  if (formatItalic) enabledStyles.push('italic');
  if (formatStrikethrough) enabledStyles.push('strike');
  if (formatUnderline) enabledStyles.push('underline');

  const allowEmojis = Boolean(includeEmojis);
  const allowMentions = Boolean(includeMentions);
  const allowDoubleMentions = allowMentions && Boolean(includeDoubleMentions);
  const allowLinks = Boolean(includeLinks);
  const allowReactions = Boolean(includeReactions);
  const allowBotMessages = Boolean(includeBotMessages);
  const allowPinnedMessages = Boolean(includePinnedMessages);

  const allowStickerFiles = Boolean(includeStickers);
  const allowGifFiles = Boolean(includeGifs);
  const allowFilesWithText = Boolean(includeFilesWithText);
  const allowMultipleFilesInMessage = Boolean(includeMultipleFiles);
  let allowAnyFiles = allowStickerFiles || allowGifFiles || allowFilesWithText || allowMultipleFilesInMessage;

  // Back-compat: if the new file toggles aren't present at all, fall back to legacy includeFileUploads.
  const hasNewFileControls =
    includeStickers !== undefined ||
    includeGifs !== undefined ||
    includeFilesWithText !== undefined ||
    includeMultipleFiles !== undefined;
  if (!hasNewFileControls) {
    allowAnyFiles = Boolean(includeFileUploads);
  }

  const allowThreadedMessages = Boolean(includeThreads);
  const allowThreadReplies = allowThreadedMessages && Boolean(includeThreadReplies);

  if (!Array.isArray(dateEntries) || dateEntries.length === 0) {
    throw new Error('Date generation error: dateEntries must be provided');
  }

  // Build coverage requirements: each enabled toggle must produce at least one message (round-robin across msgIndex)
  const requirements = buildCoverageRequirements(messageRules, {
    formatBold, formatItalic, formatStrikethrough, formatUnderline,
    includeEmojis, includeMentions, includeDoubleMentions, includeLinks, includeReactions,
    includeStickers, includeGifs, includeFilesWithText, includeMultipleFiles,
    includeBotMessages, includePinnedMessages, includeThreads, includeThreadReplies,
    includeForwardedMessages, includeEditedMessages,
    allowAnyFiles, enabledStyles,
  });

  const byDate = {};
  for (const { dateStr } of dateEntries) {
    byDate[dateStr] = [];
  }

  for (let dayIndex = 0; dayIndex < dateEntries.length; dayIndex++) {
    const { dateStr, dayStartTs } = dateEntries[dayIndex];

    const parentMessages = [];
    for (let msgIndex = 0; msgIndex < messagesPerDate; msgIndex++) {
      // Deterministic timestamps that NEVER spill into the next day.
      // This guarantees numberOfDates=N will never create >N date files.
      const repliesPerParent = allowThreadReplies ? getRepliesPerParent(messageRules) : 0;
      const maxExtraSeconds =
        (allowThreadReplies ? Math.max(0, repliesPerParent) * 60 : 0) +
        (includeEditedMessages ? 60 : 0);
      const latestParentSecond = Math.max(0, 86399 - maxExtraSeconds);
      const parentSecond =
        messagesPerDate <= 1
          ? 0
          : Math.floor((msgIndex * latestParentSecond) / (messagesPerDate - 1));
      const ts = (dayStartTs + parentSecond).toString();

      // Requirement-driven forcing: every enabled type gets at least one message (round-robin by msgIndex)
      const reqForMsg = requirements.filter((_, j) => j % messagesPerDate === msgIndex);
      const forceBotMessage = allowBotMessages && reqForMsg.includes('bot');
      const forcePinned = allowPinnedMessages && reqForMsg.includes('pinned');
      const forceMultiFile = allowAnyFiles && allowMultipleFilesInMessage && reqForMsg.includes('multiFile');
      const forceStickerFile = allowAnyFiles && allowStickerFiles && reqForMsg.includes('stickerFile');
      const forceGifFile = allowAnyFiles && allowGifFiles && reqForMsg.includes('gifFile');
      const forceFilesWithText = allowAnyFiles && allowFilesWithText && reqForMsg.includes('filesWithText');
      const forceFileOnly = allowAnyFiles && (forceStickerFile || forceGifFile || reqForMsg.includes('fileOnly'));
      const forceForwarded = Boolean(includeForwardedMessages) && reqForMsg.includes('forwarded');
      const forceEdited = Boolean(includeEditedMessages) && reqForMsg.includes('edited');
      const forceReactions = allowReactions && reqForMsg.includes('reactions');
      const forceEmojiOnly = allowEmojis && reqForMsg.includes('emojiOnly');
      const forceLink = allowLinks && reqForMsg.includes('link');
      const forceEmoji = allowEmojis && (reqForMsg.includes('emoji') || forceFileOnly);
      const forceMentionSingle = allowMentions && reqForMsg.includes('mentionSingle');
      const forceMentionDouble = allowMentions && allowDoubleMentions && reqForMsg.includes('mentionDouble');
      const forcedStyle = reqForMsg.find((r) => ['bold', 'italic', 'strike', 'underline'].includes(r)) || undefined;

      const isBotMessage = participantUserIds.length > 0 && allowBotMessages && (forceBotMessage || chance(0.15));
      const senderId = participantUserIds.length > 0 ? pickOne(participantUserIds) : undefined;

      const mentionCandidates = participantUserIds.filter((u) => u && u !== senderId);
      const forceMentionsList = [];
      if (forceMentionSingle || forceMentionDouble) {
        const take = forceMentionDouble && mentionCandidates.length >= 1 ? 2 : 1;
        forceMentionsList.push(...mentionCandidates.slice(0, take));
      }

      // Use emoji-only branch only when this message does not also need link/mentions/formatting (so coverage is not lost)
      const useEmojiOnlyBranch = forceEmojiOnly && !forceLink && forceMentionsList.length === 0 && !forcedStyle;

      const content = useEmojiOnlyBranch
        ? generateRichMessageContent({
            baseText: '',
            includeMentions: false,
            includeDoubleMentions: false,
            mentionCandidates: [],
            includeLinks: false,
            includeEmojis: allowEmojis,
            forcedStyle: undefined,
            allowedStyles: enabledStyles,
            allowEmptyText: true,
            forceEmojiOnly: true,
          })
        : generateRichMessageContent({
            baseText: pickOne(SAMPLE_TEXTS),
            includeMentions: allowMentions,
            includeDoubleMentions: allowDoubleMentions,
            mentionCandidates,
            includeLinks: allowLinks,
            includeEmojis: allowEmojis,
            forcedStyle: forcedStyle || undefined,
            allowedStyles: enabledStyles,
            forceLink,
            forceEmoji,
            forceMentions: forceMentionsList.length ? forceMentionsList : (allowMentions && msgIndex === 0 ? mentionCandidates.slice(0, 2) : []),
          });

      /** @type {any} */
      const message = {
        type: 'message',
        ts,
        text: content.text, // fallback
        blocks: content.blocks,
        client_msg_id: clientMsgId(),
        thread_ts: ts,
      };
      ensureBlockIds(message.blocks);

      if (isBotMessage) {
        message.subtype = 'bot_message';
        message.bot_id = generateBotId();
        message.username = pickOne(BOT_USERNAMES);
        message.icons = { emoji: ':robot_face:' };
      } else if (senderId) {
        message.user = senderId;
        message.display_as_bot = false;
        message.team = DEFAULT_TEAM_ID;
        message.user_team = DEFAULT_TEAM_ID;
        message.source_team = DEFAULT_TEAM_ID;
        message.user_profile = buildUserProfile(senderId);
      }

      // Pinned messages
      if (allowPinnedMessages && conversationId && (forcePinned || chance(0.05))) {
        message.is_pinned = true;
        message.pinned_to = [conversationId];
      }

      // Files (including multiple files + special character names); force at least one per enabled type
      const forceAnyFile = forceMultiFile || forceStickerFile || forceGifFile || forceFilesWithText || forceFileOnly;
      if (allowAnyFiles && (forceAnyFile || chance(0.35))) {
        const shouldMulti = allowMultipleFilesInMessage && (forceMultiFile || chance(0.25));
        const fileCount = shouldMulti ? randInt(2, 3) : 1;
        const uploaderId = message.user || pickOne(participantUserIds);
        const kinds = [];
        if (forceStickerFile) kinds.push('sticker');
        if (forceGifFile) kinds.push('gif');
        if (allowStickerFiles && !forceStickerFile) kinds.push('sticker');
        if (allowGifFiles && !forceGifFile) kinds.push('gif');
        if (allowFilesWithText || allowMultipleFilesInMessage) kinds.push('file');
        if (kinds.length === 0) kinds.push('file');

        message.files = generateFileUpload({ uploaderId, ts: Number(ts), count: fileCount, kinds, teamId: DEFAULT_TEAM_ID });

        // Slack export format: file messages include upload, display_as_bot
        message.upload = false;
        message.display_as_bot = false;

        // Slack often uses subtype=file_share for file messages
        if (!message.subtype) {
          message.subtype = 'file_share';
        }

        // When "Files with text" is forced, keep main content; otherwise allow file-only when forced or by chance
        const useFileOnly = !forceFilesWithText && (!allowFilesWithText || forceFileOnly || chance(0.25));
        if (useFileOnly) {
          const fileOnlyContent = generateRichMessageContent({
            baseText: '',
            includeMentions: false,
            includeDoubleMentions: false,
            mentionCandidates: [],
            includeLinks: false,
            includeEmojis: allowEmojis,
            forcedStyle: undefined,
            allowedStyles: enabledStyles,
            allowEmptyText: true,
            forceEmoji: true,
          });
          message.text = fileOnlyContent.text;
          message.blocks = fileOnlyContent.blocks;
        }
      }

      // Forwarded messages (attachments with blocks)
      if (includeForwardedMessages && (forceForwarded || chance(0.15)) && participantUserIds.length > 0) {
        const forwardedFrom = pickOne(participantUserIds);
        const forwardedContent = buildRichTextContent([
          { type: 'text', text: 'Forwarded message from ' },
          ...(forwardedFrom ? [{ type: 'user', user_id: forwardedFrom }] : []),
          { type: 'text', text: ': ' },
          { type: 'text', text: 'Forwarded message content' },
        ]);

        message.attachments = [
          {
            fallback: forwardedContent.text,
            text: forwardedContent.text,
            blocks: forwardedContent.blocks,
          },
        ];
      }

      // Edited messages
      if (includeEditedMessages && (forceEdited || chance(0.25))) {
        const editorId = message.user || pickOne(participantUserIds);
        message.edited = {
          user: editorId,
          ts: (Number(ts) + 60).toString(),
        };
        appendRichTextSuffix(message, ' (edited)');
      }

      // Reactions across all message types (user, bot, file, etc.)
      if (allowReactions && (forceReactions || chance(0.35))) {
        message.reactions = generateReactions(participantUserIds);
      }

      parentMessages.push(message);
    }

    // Threads and replies (Slack-style: replies are separate messages with thread_ts)
    if (allowThreadReplies && parentMessages.length > 0) {
      const repliesPerParent = getRepliesPerParent(messageRules);
      const parentsToThread = uniquePreserveOrder([
        parentMessages[0],
        ...parentMessages.slice(1).filter(() => chance(0.2)),
      ]);

      for (const parent of parentsToThread) {
        if (repliesPerParent <= 0) continue;

        const parentTs = parent.ts;
        const replyUsers = [];
        const replies = [];

        for (let i = 0; i < repliesPerParent; i++) {
          const replyTs = (Number(parentTs) + 60 + i * 60).toString();
          const replySender = pickOne(participantUserIds);
          const mentionCandidates = participantUserIds.filter((u) => u && u !== replySender);
          const forcedStyle = i === 0 && enabledStyles.length > 0 ? pickOne(enabledStyles) : undefined;
          const forceReplyLink = allowLinks && i === 0;
          const forceReplyEmoji = allowEmojis && i === 0;
          const forceReplyMentions = allowMentions && i === 0 ? mentionCandidates.slice(0, 2) : [];

          const replyContent = generateRichMessageContent({
            baseText: pickOne(SAMPLE_TEXTS),
            includeMentions: allowMentions,
            includeDoubleMentions: allowDoubleMentions,
            mentionCandidates,
            includeLinks: allowLinks,
            includeEmojis: allowEmojis,
            forcedStyle,
            allowedStyles: enabledStyles,
            forceLink: forceReplyLink,
            forceEmoji: forceReplyEmoji,
            forceMentions: forceReplyMentions,
          });

          /** @type {any} */
          const reply = {
            type: 'message',
            ts: replyTs,
            thread_ts: parentTs,
            text: replyContent.text,
            blocks: replyContent.blocks,
            client_msg_id: clientMsgId(),
            team: DEFAULT_TEAM_ID,
            user_team: DEFAULT_TEAM_ID,
            source_team: DEFAULT_TEAM_ID,
          };

          if (replySender) {
            reply.user = replySender;
            reply.user_profile = buildUserProfile(replySender);
          }
          if (parent.user) {
            reply.parent_user_id = parent.user;
          }
          ensureBlockIds(reply.blocks);

          // Replies can include files + text
          const forceReplyFiles = allowAnyFiles && i === 0;
          if (allowAnyFiles && (forceReplyFiles || chance(0.25))) {
            const shouldMulti = allowMultipleFilesInMessage && (i === 0 || chance(0.2));
            const fileCount = shouldMulti ? randInt(2, 3) : 1;
            const kinds = [];
            if (allowStickerFiles) kinds.push('sticker');
            if (allowGifFiles) kinds.push('gif');
            if (allowFilesWithText || allowMultipleFilesInMessage) kinds.push('file');
            if (kinds.length === 0) kinds.push('file');

            reply.files = generateFileUpload({ uploaderId: reply.user || pickOne(participantUserIds), ts: Number(replyTs), count: fileCount, kinds, teamId: DEFAULT_TEAM_ID });
            if (!reply.subtype) reply.subtype = 'file_share';
            if (!allowFilesWithText) {
              const fileOnlyContent = generateRichMessageContent({
                baseText: '',
                includeMentions: false,
                includeDoubleMentions: false,
                mentionCandidates: [],
                includeLinks: false,
                includeEmojis: allowEmojis,
                forcedStyle: undefined,
                allowedStyles: enabledStyles,
                allowEmptyText: true,
                forceEmoji: allowEmojis,
              });
              reply.text = fileOnlyContent.text;
              reply.blocks = fileOnlyContent.blocks;
            }
          }

          // Replies can be pinned too (optional)
          if (allowPinnedMessages && chance(0.03) && conversationId) {
            reply.is_pinned = true;
            reply.pinned_to = [conversationId];
          }

          if (allowReactions && (i === 0 || chance(0.3))) {
            reply.reactions = generateReactions(participantUserIds);
          }

          if (includeEditedMessages && (i === 0 || chance(0.2))) {
            reply.edited = {
              user: reply.user || pickOne(participantUserIds),
              ts: (Number(replyTs) + 30).toString(),
            };
            appendRichTextSuffix(reply, ' (edited)');
          }

          replies.push(reply);
          if (reply.user) replyUsers.push(reply.user);
        }

        const uniqueReplyUsers = uniquePreserveOrder(replyUsers);
        parent.reply_count = replies.length;
        parent.reply_users = uniqueReplyUsers;
        parent.reply_users_count = uniqueReplyUsers.length;
        parent.latest_reply = replies.length > 0 ? replies[replies.length - 1].ts : undefined;
        // Slack export format: parent includes replies array of { user, ts } refs
        parent.replies = replies.map((r) => ({ user: r.user, ts: r.ts }));
        parent.is_locked = false;
        parent.subscribed = true;
        parent.last_read = parent.latest_reply;

        parentMessages.push(...replies);
      }
    }

    parentMessages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));

    // MANDATORY: before ZIP, verify every enabled type produced at least one message
    ensureCoverage(parentMessages, messageRules);

    byDate[dateStr] = parentMessages;
  }

  return byDate;
}

const SAMPLE_TEXTS = [
  'Hey, how are you doing?',
  'Just checking in!',
  'Thanks for the update.',
  'That sounds great!',
  "Let me know when you're ready.",
  'Can we schedule a meeting?',
  "I'll send that over shortly.",
  'Here is the link you asked for.',
  'Please review the attached file(s).',
];

const BOT_USERNAMES = ['ExportBot', 'SlackHelper', 'ArchiveBot', 'Notifications'];

function generateBotId() {
  return `B${Math.random().toString(36).slice(2, 11).toUpperCase()}`;
}

function buildStyledTextElements(text, forcedStyle, allowedStyles) {
  if (!text) return [];

  const words = String(text).split(' ');
  if (words.length <= 1) {
    return [{ type: 'text', text }];
  }

  const allowed = Array.isArray(allowedStyles) ? allowedStyles.filter(Boolean) : [];
  const styleKey = forcedStyle && allowed.includes(forcedStyle) ? forcedStyle : (allowed.length > 0 ? pickOne(allowed) : undefined);
  if (!styleKey) {
    return [{ type: 'text', text }];
  }
  const idx = randInt(0, words.length - 1);
  const before = words.slice(0, idx).join(' ');
  const styled = words[idx];
  const after = words.slice(idx + 1).join(' ');

  const elements = [];
  if (before) elements.push({ type: 'text', text: before + ' ' });
  elements.push({ type: 'text', text: styled, style: { [styleKey]: true } });
  if (after) elements.push({ type: 'text', text: ' ' + after });
  return elements;
}

function generateRichMessageContent({
  baseText,
  includeMentions,
  includeDoubleMentions,
  mentionCandidates,
  includeLinks,
  includeEmojis,
  forcedStyle,
  allowedStyles,
  allowEmptyText = false,
  forceLink = false,
  forceEmoji = false,
  forceEmojiOnly = false,
  forceMentions = [],
}) {
  const elements = [];

  if (forceEmojiOnly) {
    elements.push({ type: 'emoji', name: pickOne(['smile', 'thumbsup', 'rocket', 'fire', 'eyes', 'clap', 'heart']) });
    if (chance(0.4)) {
      elements.push({ type: 'text', text: ' ' });
      elements.push({ type: 'emoji', name: pickOne(['smile', 'rocket', 'fire', 'heart']) });
    }
    return buildRichTextContent(elements);
  }

  // Optional leading emoji
  if (includeEmojis && (forceEmoji || chance(0.25))) {
    elements.push({ type: 'emoji', name: pickOne(['smile', 'thumbsup', 'rocket', 'fire', 'eyes', 'clap']) });
    elements.push({ type: 'text', text: ' ' });
  }

  // Mentions: single / multiple / double
  const forcedMentionList = Array.isArray(forceMentions) ? forceMentions.filter(Boolean) : [];
  if (forcedMentionList.length > 0) {
    for (const uid of uniquePreserveOrder(forcedMentionList)) {
      elements.push({ type: 'user', user_id: uid });
      elements.push({ type: 'text', text: ' ' });
    }
  } else if (includeMentions && Array.isArray(mentionCandidates) && mentionCandidates.length > 0 && chance(0.6)) {
    const mentionCount = Math.min(randInt(1, Math.min(3, mentionCandidates.length)), mentionCandidates.length);
    const selected = uniquePreserveOrder(
      Array.from({ length: mentionCount }).map(() => pickOne(mentionCandidates))
    );

    // Place mentions at start
    for (const uid of selected) {
      elements.push({ type: 'user', user_id: uid });
      elements.push({ type: 'text', text: ' ' });
      if (includeDoubleMentions && chance(0.25)) {
        elements.push({ type: 'user', user_id: uid });
        elements.push({ type: 'text', text: ' ' });
      }
    }
  }

  // Styled text fragments (bold/italic/strike/underline)
  const resolvedText = (allowEmptyText && baseText === '') ? '' : (baseText || pickOne(SAMPLE_TEXTS));
  elements.push(...buildStyledTextElements(resolvedText, forcedStyle, allowedStyles));

  // Optional inline emoji inside text
  if (includeEmojis && (forceEmoji || chance(0.25))) {
    elements.push({ type: 'text', text: ' ' });
    elements.push({ type: 'emoji', name: pickOne(['smile', 'heart', 'rocket', 'fire']) });
  }

  // Optional link mixed with text
  if (includeLinks && (forceLink || chance(0.35))) {
    elements.push({ type: 'text', text: ' ' });
    const url = pickOne([
      'https://docs.slack.dev/reference/block-kit/blocks/rich-text-block',
      'https://slack.com',
      'https://example.com/docs?ref=dm-export',
    ]);
    if (chance(0.5)) {
      elements.push({ type: 'link', url, text: 'docs' });
    } else {
      elements.push({ type: 'link', url });
    }
  }

  // File-only messages still need blocks
  if (elements.length === 0) {
    elements.push({ type: 'text', text: '' });
  }

  return buildRichTextContent(elements);
}

/**
 * Generates message text with optional mentions
 */
function elementsToFallbackText(elements) {
  return elements
    .map((el) => {
      if (!el || typeof el !== 'object') return '';
      switch (el.type) {
        case 'text':
          return el.text || '';
        case 'user':
          return el.user_id ? `<@${el.user_id}>` : '';
        case 'emoji':
          return el.name ? `:${el.name}:` : '';
        case 'link': {
          if (!el.url) return '';
          if (el.text) return `<${el.url}|${el.text}>`;
          return `<${el.url}>`;
        }
        case 'channel':
          return el.channel_id ? `<#${el.channel_id}>` : '';
        case 'usergroup':
          return el.usergroup_id ? `<!subteam^${el.usergroup_id}>` : '';
        case 'broadcast':
          return el.range ? `<!${el.range}>` : '';
        default:
          return '';
      }
    })
    .join('');
}

function buildRichTextContent(richTextSectionElements) {
  const safeElements = Array.isArray(richTextSectionElements) ? richTextSectionElements : [];

  const blocks = [
    {
      type: 'rich_text',
      elements: [
        {
          type: 'rich_text_section',
          elements: safeElements,
        },
      ],
    },
  ];

  return {
    text: elementsToFallbackText(safeElements),
    blocks,
  };
}

function appendRichTextSuffix(message, suffixText) {
  if (!message || typeof message !== 'object') return;

  // Keep the plain-text fallback aligned
  if (typeof message.text === 'string') {
    message.text += suffixText;
  } else {
    message.text = suffixText;
  }

  // Ensure blocks exist and follow rich_text schema
  if (!Array.isArray(message.blocks) || message.blocks.length === 0) {
    const content = buildRichTextContent([{ type: 'text', text: message.text }]);
    message.blocks = content.blocks;
    return;
  }

  const block = message.blocks[0];
  if (!block || block.type !== 'rich_text' || !Array.isArray(block.elements) || block.elements.length === 0) {
    const content = buildRichTextContent([{ type: 'text', text: message.text }]);
    message.blocks = content.blocks;
    return;
  }

  const section = block.elements[0];
  if (!section || section.type !== 'rich_text_section' || !Array.isArray(section.elements)) {
    const content = buildRichTextContent([{ type: 'text', text: message.text }]);
    message.blocks = content.blocks;
    return;
  }

  // Keep suffix at the very end (after mentions/emojis/etc.)
  const lastEl = section.elements[section.elements.length - 1];
  if (lastEl && lastEl.type === 'text' && typeof lastEl.text === 'string') {
    lastEl.text += suffixText;
    return;
  }

  section.elements.push({ type: 'text', text: suffixText });
}

/**
 * Generates reactions for messages
 */
function generateReactions(userIds) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  const emojis = ['thumbsup', 'heart', 'smile', 'clap', 'fire', 'rocket'];
  const numReactions = Math.floor(Math.random() * 3) + 1;
  const reactions = [];
  
  for (let i = 0; i < numReactions; i++) {
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const existingReaction = reactions.find(r => r.name === emoji);
    
    if (existingReaction) {
      const remainingUsers = uniqueUserIds.filter((u) => !existingReaction.users.includes(u));
      if (remainingUsers.length === 0) continue;
      const pickedUser = remainingUsers[Math.floor(Math.random() * remainingUsers.length)];
      existingReaction.users.push(pickedUser);
      existingReaction.count = existingReaction.users.length;
    } else {
      if (uniqueUserIds.length === 0) continue;
      const pickedUser = uniqueUserIds[Math.floor(Math.random() * uniqueUserIds.length)];
      reactions.push({
        name: emoji,
        count: 1,
        users: [pickedUser]
      });
    }
  }
  
  return reactions;
}

/**
 * Generates a file upload object (Slack export format: cfqamsg-files-pub-channel style)
 */
function generateFileUpload({ uploaderId, ts, count, kinds, teamId } = {}) {
  const created = Number.isFinite(ts) ? Math.floor(ts) : Math.floor(Date.now() / 1000);
  const filesCount = Number.isInteger(count) && count > 0 ? count : 1;
  const team = teamId || DEFAULT_TEAM_ID;

  const fileDefs = [
    // Normal files
    { kind: 'file', ext: 'png', mimetype: 'image/png', filetype: 'png', pretty_type: 'PNG' },
    { kind: 'file', ext: 'jpg', mimetype: 'image/jpeg', filetype: 'jpg', pretty_type: 'JPEG' },
    { kind: 'file', ext: 'pdf', mimetype: 'application/pdf', filetype: 'pdf', pretty_type: 'PDF' },
    { kind: 'file', ext: 'docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filetype: 'docx', pretty_type: 'Word Document' },
    { kind: 'file', ext: 'xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filetype: 'xlsx', pretty_type: 'Excel Spreadsheet' },
    { kind: 'file', ext: 'txt', mimetype: 'text/plain', filetype: 'text', pretty_type: 'Plain Text' },
    { kind: 'file', ext: 'mp4', mimetype: 'video/mp4', filetype: 'mp4', pretty_type: 'MP4 Video' },
    { kind: 'file', ext: 'mov', mimetype: 'video/quicktime', filetype: 'mov', pretty_type: 'QuickTime Video' },
    { kind: 'file', ext: 'mp3', mimetype: 'audio/mpeg', filetype: 'mp3', pretty_type: 'MP3 Audio' },

    // GIFs (treated as files)
    { kind: 'gif', ext: 'gif', mimetype: 'image/gif', filetype: 'gif', pretty_type: 'GIF' },

    // Stickers (treated as files)
    { kind: 'sticker', ext: 'png', mimetype: 'image/png', filetype: 'png', pretty_type: 'PNG' },
  ];

  const nameBases = [
    'Quarterly Report (Final)',
    'Project Plan v2.1',
    'Screenshot 2026-01-01 10.30.00',
    'Invoice #12345',
    'Meeting Notes — Q1',
    'Résumé – José Álvarez',
    'Design ✨ Mockup',
    'specs [draft] (v3)',
    'budget_€_2026',
    'ファイル',
  ];

  const gifBases = [
    'funny-cat',
    'reaction-gif 😂',
    'party-time 🎉',
    'loading…',
    'mood—friday',
  ];

  const stickerBases = [
    'Sticker — thumbs-up',
    'Sticker — heart',
    'Sticker — clap',
    'Sticker ✨',
    'ステッカー',
  ];

  const allowedKinds = Array.isArray(kinds) ? kinds.filter(Boolean) : null;
  const selectableDefs = allowedKinds && allowedKinds.length > 0
    ? fileDefs.filter((d) => allowedKinds.includes(d.kind))
    : fileDefs;
  const finalDefs = selectableDefs.length > 0 ? selectableDefs : fileDefs;

  const files = [];
  for (let i = 0; i < filesCount; i++) {
    const def = pickOne(finalDefs);
    const fileId = `F${Math.random().toString(36).slice(2, 11).toUpperCase()}`;
    const base =
      def.kind === 'gif'
        ? pickOne(gifBases)
        : def.kind === 'sticker'
          ? pickOne(stickerBases)
          : pickOne(nameBases);
    const name = `${base}.${def.ext}`;
    const size = randInt(10_000, 5_000_000);
    const user = uploaderId || undefined;
    const slug = encodeURIComponent(name);
    const editable = def.filetype === 'text' || def.kind === 'sticker';
    const mode = editable ? 'snippet' : 'hosted';

    const file = {
      id: fileId,
      created,
      timestamp: created,
      name,
      title: name,
      mimetype: def.mimetype,
      filetype: def.filetype,
      pretty_type: def.pretty_type,
      user,
      user_team: team,
      editable,
      size,
      mode,
      is_external: false,
      external_type: '',
      is_public: true,
      public_url_shared: false,
      display_as_bot: false,
      username: '',
      url_private: `https://files.slack.com/files-pri/${team}-${fileId}/${slug}`,
      url_private_download: `https://files.slack.com/files-pri/${team}-${fileId}/download/${slug}`,
      permalink: `https://slack.com/files/${user || 'UUNKNOWN'}/${fileId}/${slug}`,
      permalink_public: `https://slack-files.com/${team}-${fileId}-${Math.random().toString(36).slice(2, 10)}`,
      is_starred: false,
      skipped_shares: true,
      has_rich_preview: false,
      file_access: 'visible',
    };
    if (editable) {
      file.edit_link = `https://slack.com/files/${user || 'UUNKNOWN'}/${fileId}/${slug}/edit`;
    }

    if (['pdf', 'docx', 'xlsx'].includes(def.filetype)) {
      file.media_display_type = 'unknown';
      const baseUrl = `https://files.slack.com/files-tmb/${team}-${fileId}-${Math.random().toString(36).slice(2, 10)}`;
      const safeName = name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
      file.converted_pdf = `${baseUrl}/${safeName}_converted.pdf`;
      file.thumb_pdf = `${baseUrl}/${safeName}_thumb_pdf.png`;
      file.thumb_pdf_w = 909;
      file.thumb_pdf_h = 1286;
    }

    files.push(file);
  }

  return files;
}

module.exports = { generateSlackExport };
