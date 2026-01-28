# Setup Instructions

## Network/Proxy Issues

If you're experiencing network connectivity issues with npm, try the following:

### Option 1: Fix npm offline mode
```powershell
# Remove offline mode
npm config delete offline
# Or set it to false
npm config set offline false
```

### Option 2: Clear npm cache and retry
```powershell
npm cache clean --force
npm install
```

### Option 3: Manual Installation

If automatic installation fails, install dependencies manually:

1. **Root directory:**
   ```powershell
   cd "c:\Users\KiranUmmenthala\OneDrive - CloudFuze, Inc\Desktop\JsonProject"
   npm install
   ```

2. **Server directory:**
   ```powershell
   cd server
   npm install
   cd ..
   ```

3. **Client directory:**
   ```powershell
   cd client
   npm install
   cd ..
   ```

### Option 4: Use the setup script
```powershell
.\setup.ps1
```

## Running the Project

Once dependencies are installed:

```powershell
npm run dev
```

This will start:
- Backend server on `http://localhost:5000`
- React frontend on `http://localhost:3000`

## Alternative: Run separately

**Terminal 1 (Backend):**
```powershell
cd server
npm start
```

**Terminal 2 (Frontend):**
```powershell
cd client
npm start
```

## Troubleshooting

### If you see "Cannot find module" errors:
- Make sure you've installed dependencies in all three directories (root, server, client)

### If port 3000 or 5000 is already in use:
- Change the port in `client/package.json` (React) or `server/index.js` (Express)

### If npm install fails due to network:
- Check your internet connection
- Check if you're behind a corporate proxy
- Try: `npm config set registry https://registry.npmjs.org/`
- Try: `npm install --no-optional`
