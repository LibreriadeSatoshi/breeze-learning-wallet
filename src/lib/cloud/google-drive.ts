/**
 * Google Drive integration for encrypted backup
 * Uses Google Drive API v3 with OAuth2
 */

import type { EncryptedData } from '../crypto/encryption';

// Google API type declarations
declare global {
  interface Window {
    gapi: any;
  }
  const gapi: any;
}

const BACKUP_FOLDER_NAME = 'EttaWallet Backups';
const BACKUP_FILE_NAME = 'wallet-backup.json';

// Google OAuth2 configuration
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

interface GoogleAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

let accessToken: string | null = null;

/**
 * Initialize Google Drive OAuth
 */
export async function initGoogleDrive(): Promise<boolean> {
  try {
    // Check if Google API is loaded
    if (typeof window === 'undefined' || !window.gapi) {
      console.error('Google API not loaded');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to initialize Google Drive:', error);
    return false;
  }
}

/**
 * Authenticate with Google using OAuth2
 */
export async function authenticateGoogle(): Promise<boolean> {
  try {
    // Load the auth2 library
    await new Promise<void>((resolve) => {
      gapi.load('auth2', () => resolve());
    });

    // Initialize auth2
    const auth2 = await gapi.auth2.init({
      client_id: CLIENT_ID,
      scope: SCOPES,
    });

    // Sign in
    const googleUser = await auth2.signIn();
    const authResponse = googleUser.getAuthResponse();
    accessToken = authResponse.access_token;

    return true;
  } catch (error) {
    console.error('Google authentication failed:', error);
    return false;
  }
}

/**
 * Find or create backup folder in Google Drive
 */
async function getBackupFolderId(): Promise<string | null> {
  if (!accessToken) return null;

  try {
    // Search for existing folder
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const searchData = await searchResponse.json();

    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    // Create folder if it doesn't exist
    const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: BACKUP_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    const createData = await createResponse.json();
    return createData.id;
  } catch (error) {
    console.error('Failed to get/create backup folder:', error);
    return null;
  }
}

/**
 * Upload encrypted backup to Google Drive
 */
export async function uploadBackup(encryptedData: EncryptedData): Promise<boolean> {
  if (!accessToken) {
    throw new Error('Not authenticated with Google');
  }

  try {
    const folderId = await getBackupFolderId();
    if (!folderId) {
      throw new Error('Failed to get backup folder');
    }

    // Check if backup file already exists
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const searchData = await searchResponse.json();
    const fileId = searchData.files && searchData.files.length > 0 ? searchData.files[0].id : null;

    // Prepare backup data
    const backupData = {
      ...encryptedData,
      version: '1.0',
      app: 'EttaWallet',
    };

    const metadata = {
      name: BACKUP_FILE_NAME,
      mimeType: 'application/json',
      parents: [folderId],
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(backupData)], { type: 'application/json' }));

    // Upload or update file
    const url = fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    const method = fileId ? 'PATCH' : 'POST';

    const uploadResponse = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    });

    if (!uploadResponse.ok) {
      throw new Error('Upload failed');
    }

    return true;
  } catch (error) {
    console.error('Failed to upload backup:', error);
    return false;
  }
}

/**
 * Download encrypted backup from Google Drive
 */
export async function downloadBackup(): Promise<EncryptedData | null> {
  if (!accessToken) {
    throw new Error('Not authenticated with Google');
  }

  try {
    const folderId = await getBackupFolderId();
    if (!folderId) return null;

    // Find backup file
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const searchData = await searchResponse.json();

    if (!searchData.files || searchData.files.length === 0) {
      return null;
    }

    const fileId = searchData.files[0].id;

    // Download file content
    const downloadResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const backupData = await downloadResponse.json();

    return {
      ciphertext: backupData.ciphertext,
      salt: backupData.salt,
      iv: backupData.iv,
      timestamp: backupData.timestamp,
    };
  } catch (error) {
    console.error('Failed to download backup:', error);
    return null;
  }
}

/**
 * Check if backup exists
 */
export async function hasBackup(): Promise<boolean> {
  if (!accessToken) return false;

  try {
    const backup = await downloadBackup();
    return backup !== null;
  } catch {
    return false;
  }
}

/**
 * Sign out from Google
 */
export async function signOutGoogle(): Promise<void> {
  try {
    const auth2 = gapi.auth2.getAuthInstance();
    if (auth2) {
      await auth2.signOut();
    }
    accessToken = null;
  } catch (error) {
    console.error('Failed to sign out:', error);
  }
}
