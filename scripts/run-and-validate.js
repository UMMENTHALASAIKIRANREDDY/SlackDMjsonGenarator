/**
 * Generates an export with all message types enabled, then validates Block Kit structure.
 * Usage: node scripts/run-and-validate.js
 * (Runs generator directly - no server required.)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE = path.join(__dirname, '..');
const EXPORT_DIR = path.join(BASE, 'extracted-export');
const validateScript = path.join(__dirname, 'validate-export.js');

const exportPayload = {
  oneOnOneDMs: [
    { channelId: 'D001', userId1: 'U00000001', userId2: 'U00000002' },
  ],
  groupDMs: [
    {
      groupName: 'mpim-test',
      channelId: 'G001',
      creatorUserId: 'U00000001',
      memberUserIds: 'U00000002,U00000003',
    },
  ],
  messageRules: {
    startDate: '2026-01-01',
    numberOfDates: 2,
    messagesPerDate: 18,
    repliesPerMessage: 2,

    formatBold: true,
    formatItalic: true,
    formatStrikethrough: true,
    formatUnderline: true,

    includeEmojis: true,
    includeMentions: true,
    includeDoubleMentions: true,
    includeLinks: true,
    includeReactions: true,
    includeStickers: true,
    includeGifs: true,
    includeFilesWithText: true,
    includeMultipleFiles: true,

    includeBotMessages: true,
    includePinnedMessages: true,
    includeThreads: true,
    includeThreadReplies: true,

    includeFileUploads: true,
    includeForwardedMessages: true,
    includeEditedMessages: true,
  },
};

function main() {
  console.log('1. Generating Slack export (all features enabled)...');
  const { generateSlackExport } = require(path.join(BASE, 'server', 'slackExportGenerator.js'));

  if (fs.existsSync(EXPORT_DIR)) {
    fs.rmSync(EXPORT_DIR, { recursive: true });
  }
  fs.mkdirSync(EXPORT_DIR, { recursive: true });

  generateSlackExport(exportPayload, EXPORT_DIR)
    .then(() => {
      console.log('2. Export written to', EXPORT_DIR);
      console.log('3. Running validation...');
      execSync(`node "${validateScript}" "${EXPORT_DIR}"`, {
        stdio: 'inherit',
        cwd: BASE,
      });
      console.log('\nDone. All data types and Block Kit structure validated.');
      try { fs.rmSync(EXPORT_DIR, { recursive: true }); } catch (_) {}
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error:', err.message);
      if (err.stack) console.error(err.stack);
      process.exit(1);
    });
}

main();
