import { createSign, randomUUID } from "crypto";

const driveScope = "https://www.googleapis.com/auth/drive.file";
const tokenUrl = "https://oauth2.googleapis.com/token";
const driveFilesUrl = "https://www.googleapis.com/drive/v3/files";
const driveUploadUrl = "https://www.googleapis.com/upload/drive/v3/files";

type DriveFile = {
  id: string;
  name: string;
  webViewLink?: string;
};

function driveConfig() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const parentFolderId = process.env.GOOGLE_DRIVE_PROPERTY_FOLDER_ID || "";
  return { clientEmail, privateKey, parentFolderId };
}

export function isGoogleDriveConfigured() {
  const { clientEmail, privateKey } = driveConfig();
  return Boolean(clientEmail && privateKey);
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function getAccessToken() {
  const { clientEmail, privateKey } = driveConfig();
  if (!clientEmail || !privateKey) {
    throw new Error("Google Drive is not configured. Add service account email and private key in Vercel.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: clientEmail,
      scope: driveScope,
      aud: tokenUrl,
      exp: now + 3600,
      iat: now,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = base64Url(signer.sign(privateKey));

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google Drive auth failed: ${response.status} ${detail}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Google Drive auth did not return an access token.");
  return data.access_token;
}

async function createDriveFile(metadata: Record<string, unknown>, accessToken: string) {
  const response = await fetch(`${driveFilesUrl}?fields=id,name,webViewLink`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google Drive file create failed: ${response.status} ${detail}`);
  }
  return (await response.json()) as DriveFile;
}

async function setAnyoneCanRead(fileId: string, accessToken: string) {
  const response = await fetch(`${driveFilesUrl}/${fileId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google Drive permission update failed: ${response.status} ${detail}`);
  }
}

async function uploadDriveFile(file: File, folderId: string, accessToken: string) {
  const boundary = `limitless_${randomUUID()}`;
  const metadata = {
    name: file.name || `property-image-${Date.now()}`,
    parents: [folderId],
  };
  const bytes = Buffer.from(await file.arrayBuffer());
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const response = await fetch(`${driveUploadUrl}?uploadType=multipart&fields=id,name,webViewLink`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google Drive upload failed: ${response.status} ${detail}`);
  }
  return (await response.json()) as DriveFile;
}

export async function uploadPropertyImagesToDrive(propertyTitle: string, files: File[]) {
  const validFiles = files.filter((file) => file.size > 0);
  if (!validFiles.length) throw new Error("Choose at least one property image to upload.");

  const { parentFolderId } = driveConfig();
  const accessToken = await getAccessToken();
  const folder = await createDriveFile(
    {
      name: `${propertyTitle || "Property"} - ${new Date().toISOString().slice(0, 10)}`,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentFolderId ? { parents: [parentFolderId] } : {}),
    },
    accessToken,
  );

  await Promise.all(validFiles.map((file) => uploadDriveFile(file, folder.id, accessToken)));
  await setAnyoneCanRead(folder.id, accessToken);

  return folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`;
}
