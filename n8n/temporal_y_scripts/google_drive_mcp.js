import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { authenticate } from "@google-cloud/local-auth";

const CREDENTIALS_PATH = "F:/NSK - PROJECTS/AI AUTO GEN/USER/client_secret_935777821394-0p10o04g782cra0256nsv3ec6ea4bcns.apps.googleusercontent.com.json";
const TOKEN_PATH = "F:/NSK - PROJECTS/AI AUTO GEN/USER/google_drive_token.json";
const SCOPES = ["https://www.googleapis.com/auth/drive"];

class DriveManager {
  constructor() {
    this.drive = null;
    this.auth = null;
  }

  async init() {
    if (this.drive) return;

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH)).installed;
    const { client_id, client_secret, redirect_uris } = credentials;
    this.auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
      this.auth.setCredentials(token);
    } else {
      this.auth = await authenticate({ keyfilePath: CREDENTIALS_PATH, scopes: SCOPES });
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(this.auth.credentials));
    }
    this.drive = google.drive({ version: "v3", auth: this.auth });
  }

  async listFiles(q = "") {
    const res = await this.drive.files.list({
      pageSize: 50,
      fields: "files(id, name, mimeType)",
      q: q || "trashed = false",
    });
    return res.data.files;
  }

  async createFolder(name, parentId = null) {
    const fileMetadata = {
      name: name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : [],
    };
    const res = await this.drive.files.create({
      requestBody: fileMetadata,
      fields: "id, name",
    });
    return res.data;
  }

  async downloadFile(fileId) {
    const res = await this.drive.files.get({
      fileId: fileId,
      alt: "media",
    });
    return res.data;
  }
}

const driveManager = new DriveManager();

const server = new Server(
  { name: "custom-google-drive", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_drive_files",
      description: "List files and folders from Google Drive.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } }
      }
    },
    {
      name: "create_drive_folder",
      description: "Create a new folder in Google Drive.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          parentId: { type: "string" }
        },
        required: ["name"]
      }
    },
    {
      name: "download_drive_file",
      description: "Download the content of a file from Google Drive.",
      inputSchema: {
        type: "object",
        properties: {
          fileId: { type: "string" }
        },
        required: ["fileId"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  await driveManager.init();
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      case "list_drive_files":
        const files = await driveManager.listFiles(args.query);
        return { content: [{ type: "text", text: JSON.stringify(files, null, 2) }] };
      case "create_drive_folder":
        const folder = await driveManager.createFolder(args.name, args.parentId);
        return { content: [{ type: "text", text: JSON.stringify(folder, null, 2) }] };
      case "download_drive_file":
        const content = await driveManager.downloadFile(args.fileId);
        // If content is an object (JSON), stringify it. If it's a string (CSV/Text), just return it.
        const textContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
        return { content: [{ type: "text", text: textContent }] };
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return { content: [{ type: "text", text: error.message }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
