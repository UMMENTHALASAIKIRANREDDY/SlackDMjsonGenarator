/**
 * Validates extracted Slack DM export against Slack API / Block Kit structure.
 * Usage: node scripts/validate-export.js <path-to-extracted-export-dir>
 */

const fs = require('fs');
const path = require('path');

const exportDir = process.argv[2] || path.join(__dirname, '..', 'extracted-export');
const DATE_FILE_REGEX = /^\d{4}-\d{2}-\d{2}\.json$/;

// Slack Block Kit: rich text element types (https://api.slack.com/reference/block-kit/blocks/rich-text-block)
const RICH_TEXT_ELEMENT_TYPES = new Set(['text', 'user', 'emoji', 'link', 'channel', 'usergroup', 'broadcast']);
const RICH_TEXT_STYLE_KEYS = new Set(['bold', 'italic', 'strike', 'underline']);

const errors = [];
const warnings = [];
let seenMessageTypes = new Set();

function err(msg) {
  errors.push(msg);
}

function warn(msg) {
  warnings.push(msg);
}

function validateDmsJson(dir) {
  const file = path.join(dir, 'dms.json');
  if (!fs.existsSync(file)) {
    err('dms.json is missing');
    return;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    err(`dms.json invalid JSON: ${e.message}`);
    return;
  }
  if (!Array.isArray(data)) {
    err('dms.json must be an array');
    return;
  }
  data.forEach((dm, i) => {
    if (!dm || typeof dm !== 'object') {
      err(`dms.json[${i}] must be an object`);
      return;
    }
    if (!dm.id) err(`dms.json[${i}].id is required`);
    if (typeof dm.created !== 'number') err(`dms.json[${i}].created must be a number`);
    if (!Array.isArray(dm.members)) err(`dms.json[${i}].members must be an array`);
    else if (dm.members.length !== 2) err(`dms.json[${i}].members must have exactly 2 unique user IDs (got ${dm.members.length})`);
  });
}

function validateMpimsJson(dir) {
  const file = path.join(dir, 'mpims.json');
  if (!fs.existsSync(file)) {
    err('mpims.json is missing');
    return;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    err(`mpims.json invalid JSON: ${e.message}`);
    return;
  }
  if (!Array.isArray(data)) {
    err('mpims.json must be an array');
    return;
  }
  data.forEach((mpim, i) => {
    if (!mpim || typeof mpim !== 'object') {
      err(`mpims.json[${i}] must be an object`);
      return;
    }
    if (!mpim.id) err(`mpims.json[${i}].id is required`);
    if (!mpim.name) err(`mpims.json[${i}].name is required`);
    if (typeof mpim.created !== 'number') err(`mpims.json[${i}].created must be a number`);
    if (!mpim.creator) err(`mpims.json[${i}].creator is required`);
    if (typeof mpim.is_archived !== 'boolean') err(`mpims.json[${i}].is_archived must be boolean`);
    if (!Array.isArray(mpim.members)) err(`mpims.json[${i}].members must be an array`);
    if (!mpim.topic || typeof mpim.topic !== 'object') err(`mpims.json[${i}].topic is required`);
    if (!mpim.purpose || typeof mpim.purpose !== 'object') err(`mpims.json[${i}].purpose is required`);
  });
}

function validateRichTextBlock(block, context) {
  if (block.type !== 'rich_text') {
    err(`${context}: block type must be "rich_text" (got "${block.type}")`);
    return;
  }
  if (!Array.isArray(block.elements)) {
    err(`${context}: rich_text.elements must be an array`);
    return;
  }
  block.elements.forEach((el, i) => {
    if (!el || typeof el !== 'object') {
      err(`${context}: rich_text.elements[${i}] must be an object`);
      return;
    }
    if (el.type === 'rich_text_section') {
      if (!Array.isArray(el.elements)) {
        err(`${context}: rich_text_section.elements must be an array`);
        return;
      }
      el.elements.forEach((sub, j) => {
        if (!sub || typeof sub !== 'object') {
          err(`${context}: rich_text_section.elements[${j}] must be an object`);
          return;
        }
        if (!RICH_TEXT_ELEMENT_TYPES.has(sub.type) && sub.type !== 'rich_text_section') {
          warn(`${context}: unknown rich text element type "${sub.type}" (allowed: ${[...RICH_TEXT_ELEMENT_TYPES].join(', ')})`);
        }
        if (sub.type === 'text') {
          if (typeof sub.text !== 'string') err(`${context}: text element must have "text" string`);
          if (sub.style && typeof sub.style === 'object') {
            for (const k of Object.keys(sub.style)) {
              if (!RICH_TEXT_STYLE_KEYS.has(k)) warn(`${context}: text style key "${k}" not in Slack spec (bold, italic, strike, underline)`);
            }
          }
        }
        if (sub.type === 'user' && !sub.user_id) err(`${context}: user element must have user_id`);
        if (sub.type === 'emoji' && !sub.name) err(`${context}: emoji element must have name`);
        if (sub.type === 'link' && !sub.url) err(`${context}: link element must have url`);
      });
    }
  });
}

function validateMessage(msg, context) {
  if (!msg || typeof msg !== 'object') {
    err(`${context}: message must be an object`);
    return;
  }
  if (msg.type !== 'message') err(`${context}: message.type must be "message" (got "${msg.type}")`);
  if (typeof msg.ts !== 'string') err(`${context}: message.ts must be a string`);
  if (typeof msg.text !== 'string') err(`${context}: message.text must be a string (fallback)`);

  // Block Kit: messages should have blocks with rich_text
  if (!Array.isArray(msg.blocks)) {
    err(`${context}: message.blocks must be an array`);
  } else if (msg.blocks.length > 0) {
    const first = msg.blocks[0];
    validateRichTextBlock(first, `${context}.blocks[0]`);
  }

  // Track message types for coverage report
  if (msg.subtype === 'bot_message') seenMessageTypes.add('bot_message');
  if (msg.subtype === 'file_share') seenMessageTypes.add('file_share');
  if (msg.is_pinned) seenMessageTypes.add('pinned');
  if (msg.thread_ts && !msg.reply_count) seenMessageTypes.add('thread_reply');
  if (msg.reply_count != null) seenMessageTypes.add('thread_parent');
  if (msg.attachments && msg.attachments.length) seenMessageTypes.add('attachments');
  if (msg.files && msg.files.length) {
    seenMessageTypes.add('files');
    if (msg.files.length >= 2) seenMessageTypes.add('multiple_files');
    if (msg.text && msg.text.trim().length > 0) seenMessageTypes.add('files_with_text');
    msg.files.forEach((f) => {
      const name = (f.name || f.title || '').toLowerCase();
      const type = (f.filetype || f.mimetype || '').toLowerCase();
      if (name.includes('sticker') || name.includes('ステッカー')) seenMessageTypes.add('file_sticker');
      if (type.includes('gif') || name.endsWith('.gif')) seenMessageTypes.add('file_gif');
    });
  }
  if (msg.reactions && msg.reactions.length) seenMessageTypes.add('reactions');
  if (msg.edited) seenMessageTypes.add('edited');

  // Bot message structure
  if (msg.subtype === 'bot_message') {
    if (!msg.bot_id) err(`${context}: bot_message must have bot_id`);
    if (!msg.username) warn(`${context}: bot_message typically has username`);
    if (msg.icons && typeof msg.icons.emoji !== 'string') warn(`${context}: bot_message.icons.emoji should be string`);
  }

  // File share: required fields + Slack export format (user_team, editable, file_access, etc.)
  if (msg.files && Array.isArray(msg.files)) {
    msg.files.forEach((f, i) => {
      if (!f.id || !f.name || !f.mimetype || f.created == null) {
        err(`${context}: files[${i}] must have id, name, mimetype, created`);
      }
      if (!f.user_team) err(`${context}: files[${i}] must have user_team (Slack export format)`);
      if (f.editable === undefined) err(`${context}: files[${i}] must have editable (Slack export format)`);
      if (f.file_access === undefined) err(`${context}: files[${i}] must have file_access (Slack export format)`);
      if (!f.permalink_public) err(`${context}: files[${i}] must have permalink_public (Slack export format)`);
      if (f.display_as_bot === undefined) err(`${context}: files[${i}] must have display_as_bot (Slack export format)`);
    });
  }

  // Attachments (e.g. forwarded messages)
  if (msg.attachments && Array.isArray(msg.attachments)) {
    msg.attachments.forEach((att, i) => {
      if (att.blocks && Array.isArray(att.blocks) && att.blocks[0]) {
        validateRichTextBlock(att.blocks[0], `${context}.attachments[${i}].blocks[0]`);
      }
    });
  }

  // Reactions
  if (msg.reactions && Array.isArray(msg.reactions)) {
    msg.reactions.forEach((r, i) => {
      if (!r.name || !Array.isArray(r.users) || r.count == null) {
        err(`${context}: reactions[${i}] must have name, users array, count`);
      }
    });
  }

  // Thread parent fields
  if (msg.reply_count != null) {
    if (!Array.isArray(msg.reply_users)) err(`${context}: reply_count present but reply_users must be array`);
    if (typeof msg.reply_users_count !== 'number') warn(`${context}: reply_users_count recommended for thread parent`);
  }
}

function validateChannelFolder(dir, channelName) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const dateFiles = entries.filter((e) => e.isFile() && DATE_FILE_REGEX.test(e.name));
  const otherDirs = entries.filter((e) => e.isDirectory());

  if (dateFiles.length === 0) {
    err(`Channel "${channelName}" has no date files (YYYY-MM-DD.json)`);
    return;
  }

  for (const f of dateFiles) {
    const filePath = path.join(dir, f.name);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      err(`${channelName}/${f.name} invalid JSON: ${e.message}`);
      continue;
    }
    if (!Array.isArray(data)) {
      err(`${channelName}/${f.name} must be an array of messages`);
      continue;
    }
    data.forEach((msg, i) => validateMessage(msg, `${channelName}/${f.name}[${i}]`));
  }
}

function main() {
  if (!fs.existsSync(exportDir)) {
    console.error('Export directory not found:', exportDir);
    process.exit(1);
  }

  validateDmsJson(exportDir);
  validateMpimsJson(exportDir);

  const entries = fs.readdirSync(exportDir, { withFileTypes: true });
  const channelDirs = entries.filter((e) => e.isDirectory() && e.name !== 'node_modules');
  const topLevelFiles = entries.filter((e) => e.isFile()).map((e) => e.name);
  const hasDms = topLevelFiles.includes('dms.json');
  const hasMpims = topLevelFiles.includes('mpims.json');

  for (const d of channelDirs) {
    const fullPath = path.join(exportDir, d.name);
    validateChannelFolder(fullPath, d.name);
  }

  // Report
  console.log('\n--- Validation Report ---\n');
  if (warnings.length) {
    console.log('Warnings:');
    warnings.forEach((w) => console.log('  ', w));
    console.log('');
  }
  if (errors.length) {
    console.log('Errors:');
    errors.forEach((e) => console.log('  ', e));
    console.log('\nResult: FAILED');
    process.exit(1);
  }

  console.log('Block structure: OK (rich_text, rich_text_section, elements)');
  console.log('Metadata: dms.json, mpims.json structure OK');
  console.log('Message types seen:', [...seenMessageTypes].sort().join(', ') || '(none)');
  console.log('\nResult: PASSED');
  process.exit(0);
}

main();
