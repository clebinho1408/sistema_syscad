import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import { Response } from "express";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject as checkAccess,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./localAcl";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class LocalStorageService {
  private baseDir: string;

  constructor() {
    this.baseDir = process.env.LOCAL_STORAGE_PATH || "./uploads";
    this.ensureBaseDir();
  }

  private async ensureBaseDir() {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
      await fs.mkdir(path.join(this.baseDir, "uploads"), { recursive: true });
    } catch (error) {
      console.error("Error creating storage directories:", error);
    }
  }

  getBaseDir(): string {
    return this.baseDir;
  }

  async generateUploadPath(): Promise<{ objectId: string; filePath: string; objectPath: string }> {
    const objectId = randomUUID();
    const uploadsDir = path.join(this.baseDir, "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const filePath = path.join(uploadsDir, objectId);
    const objectPath = `/objects/uploads/${objectId}`;
    
    return { objectId, filePath, objectPath };
  }

  async saveFile(
    objectPath: string,
    data: Buffer,
    contentType?: string
  ): Promise<void> {
    const filePath = this.objectPathToFilePath(objectPath);
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, data);
    
    const metaPath = filePath + ".meta.json";
    await fs.writeFile(
      metaPath,
      JSON.stringify({ contentType: contentType || "application/octet-stream" }),
      "utf-8"
    );
  }

  async getFileMetadata(filePath: string): Promise<{ contentType: string; size: number }> {
    const metaPath = filePath + ".meta.json";
    let contentType = "application/octet-stream";
    
    try {
      const metaData = await fs.readFile(metaPath, "utf-8");
      const meta = JSON.parse(metaData);
      contentType = meta.contentType || contentType;
    } catch (error) {
    }

    const stats = await fs.stat(filePath);
    return { contentType, size: stats.size };
  }

  async downloadObject(filePath: string, res: Response, cacheTtlSec: number = 3600) {
    try {
      const aclPolicy = await getObjectAclPolicy(filePath);
      const isPublic = aclPolicy?.visibility === "public";

      const { contentType, size } = await this.getFileMetadata(filePath);

      res.set({
        "Content-Type": contentType,
        "Content-Length": size,
        "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
      });

      const stream = fsSync.createReadStream(filePath);

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  objectPathToFilePath(objectPath: string): string {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice("/objects/".length);
    return path.join(this.baseDir, parts);
  }

  async getObjectFile(objectPath: string): Promise<string> {
    const filePath = this.objectPathToFilePath(objectPath);

    try {
      await fs.access(filePath);
      return filePath;
    } catch (error) {
      throw new ObjectNotFoundError();
    }
  }

  normalizeObjectPath(rawPath: string): string {
    if (rawPath.startsWith("/objects/")) {
      return rawPath;
    }
    
    if (rawPath.startsWith(this.baseDir)) {
      const relativePath = rawPath.slice(this.baseDir.length);
      return `/objects${relativePath}`;
    }

    return rawPath;
  }

  async trySetObjectAclPolicy(
    objectPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectPath(objectPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const filePath = await this.getObjectFile(normalizedPath);
    await setObjectAclPolicy(filePath, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectFile({
    userId,
    filePath,
    requestedPermission,
  }: {
    userId?: string;
    filePath: string;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return checkAccess({
      userId,
      filePath,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }

  async deleteObject(objectPath: string): Promise<void> {
    const filePath = this.objectPathToFilePath(objectPath);

    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    try {
      await fs.unlink(filePath + ".meta.json");
    } catch (error) {
    }

    try {
      await fs.unlink(filePath + ".acl.json");
    } catch (error) {
    }
  }

  async fileExists(objectPath: string): Promise<boolean> {
    try {
      const filePath = this.objectPathToFilePath(objectPath);
      await fs.access(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }
}
