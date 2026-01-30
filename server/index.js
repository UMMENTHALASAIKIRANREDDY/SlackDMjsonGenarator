const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const archiver = require('archiver');
const { generateSlackExport } = require('./slackExportGenerator');

const app = express();
const PORT = Number.parseInt(process.env.PORT, 10) || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API endpoint to generate and download Slack export
app.post('/api/generate-export', async (req, res) => {
  try {
    const exportData = req.body;
    
    // Validate required fields
    if (!exportData.oneOnOneDMs || !exportData.groupDMs || !exportData.messageRules) {
      return res.status(400).json({ error: 'Missing required export data' });
    }

    // Generate Slack export structure
    const exportDir = path.join(__dirname, 'temp-export');
    await fs.ensureDir(exportDir);
    
    // Clean up any existing files
    await fs.emptyDir(exportDir);
    
    // Generate the export
    await generateSlackExport(exportData, exportDir);
    
    // Create ZIP file
    const zipPath = path.join(__dirname, 'slack-dm-export.zip');
    await createZipFile(exportDir, zipPath);
    
    // Send ZIP file
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=slack-dm-export.zip');
    
    const fileStream = fs.createReadStream(zipPath);
    fileStream.pipe(res);
    
    // Clean up after sending
    fileStream.on('end', async () => {
      await fs.remove(exportDir);
      await fs.remove(zipPath);
    });
    
  } catch (error) {
    console.error('Error generating export:', error);
    res.status(500).json({ error: 'Failed to generate export', details: error.message });
  }
});

// Helper function to create ZIP file
function createZipFile(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      console.log(`ZIP file created: ${archive.pointer()} total bytes`);
      resolve();
    });
    
    archive.on('error', (err) => {
      reject(err);
    });
    
    archive.pipe(output);
    // Add files directly to ZIP root (no parent folder)
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or set PORT to a different value.`);
    // Ensure we don't keep the process alive when bind fails
    process.exit(1);
  }

  console.error('Server error:', err);
  process.exit(1);
});

let isShuttingDown = false;
function shutdown(signal, exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`Received ${signal}. Shutting down server...`);

  // Stop accepting new connections; allow existing requests to finish
  const forceExitTimer = setTimeout(() => {
    console.error('Forced shutdown (server.close timed out).');
    process.exit(1);
  }, 10_000);

  // Don't keep the event loop alive just for the timer
  forceExitTimer.unref();

  server.close((closeErr) => {
    if (closeErr) {
      console.error('Error during server shutdown:', closeErr);
      process.exit(1);
    }

    console.log('Server closed. Port released.');
    process.exit(exitCode);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
// Windows console: Ctrl+Break
process.on('SIGBREAK', () => shutdown('SIGBREAK'));
// Unix-like terminal hangup (no-op on some Windows setups, but safe to register)
process.on('SIGHUP', () => shutdown('SIGHUP'));

// If the terminal is closed, stdin often ends/closes; treat that as a shutdown signal.
// This helps avoid orphaned Node processes holding the port.
if (process.stdin && typeof process.stdin.on === 'function') {
  // Ensure stdin is flowing so 'end'/'close' can be observed.
  try {
    process.stdin.resume();
  } catch (_) {
    // ignore
  }

  process.stdin.on('end', () => shutdown('stdin_end'));
  process.stdin.on('close', () => shutdown('stdin_close'));
}

// Best-effort graceful shutdown on crashes/rejections too
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  shutdown('uncaughtException', 1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  shutdown('unhandledRejection', 1);
});
