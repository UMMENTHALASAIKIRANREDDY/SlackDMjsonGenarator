const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const archiver = require('archiver');
const { generateSlackExport } = require('./slackExportGenerator');

const app = express();
const PORT = process.env.PORT || 5000;

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
