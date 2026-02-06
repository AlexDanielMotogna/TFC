# Quick Fix: bufferutil Build Error

## Problem
```
Error: ENOENT: no such file or directory, open 'C:\Users\Lian Li\tradefightclub\node_modules\bufferutil\index.js'
```

This happened because the `npm install ioredis` had cleanup warnings for native modules.

## Solution

Run one of these commands to fix the broken native modules:

### Option 1: Reinstall Dependencies (Recommended)
```bash
# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Option 2: Rebuild Native Modules
```bash
# Rebuild just the problematic packages
npm rebuild bufferutil utf-8-validate
```

### Option 3: Clean Install
```bash
# Use npm ci for clean install
npm ci
```

## After Fix

1. Restart your dev server:
   ```bash
   npm run dev
   ```

2. The build error should be resolved

## Why This Happened

When installing `ioredis`, npm tried to cleanup temporary directories for `bufferutil` and `utf-8-validate` (native modules used by WebSocket libraries), but Windows file locks prevented the cleanup. This left the modules in a partially installed state.

## Prevention

In the future, close all dev servers and applications using node_modules before installing new packages.
