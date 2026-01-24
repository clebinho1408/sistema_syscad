import { Response } from "express";

const isReplitEnvironment = (): boolean => {
  return !!(process.env.REPL_ID && process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID);
};

interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
}

interface StorageAdapter {
  generateUploadPath(): Promise<{ uploadURL?: string; objectPath: string; uploadId: string }>;
  saveFile(objectPath: string, data: Buffer, contentType?: string): Promise<void>;
  getFile(objectPath: string): Promise<string | any>;
  getFileBuffer(objectPath: string): Promise<Buffer>;
  downloadObject(fileHandle: any, res: Response, cacheTtlSec?: number): Promise<void>;
  normalizeObjectPath(rawPath: string): string;
  setAclPolicy(objectPath: string, aclPolicy: ObjectAclPolicy): Promise<string>;
  canAccessObject(params: { userId?: string; fileHandle: any; requestedPermission?: string }): Promise<boolean>;
  fileExists(objectPath: string): Promise<boolean>;
  isPresignedUpload(): boolean;
}

let adapter: StorageAdapter | null = null;

async function createReplitAdapter(): Promise<StorageAdapter> {
  const { ObjectStorageService } = await import("./replit_integrations/object_storage");
  const service = new ObjectStorageService();

  return {
    isPresignedUpload: () => true,

    async generateUploadPath() {
      const uploadURL = await service.getObjectEntityUploadURL();
      const objectPath = service.normalizeObjectEntityPath(uploadURL);
      const uploadId = objectPath.split("/").pop() || "";
      return { uploadURL, objectPath, uploadId };
    },

    async saveFile(_objectPath: string, _data: Buffer, _contentType?: string) {
      throw new Error("Direct save not supported in Replit - use presigned URL");
    },

    async getFile(objectPath: string) {
      return service.getObjectEntityFile(objectPath);
    },

    async getFileBuffer(objectPath: string) {
      const objectFile = await service.getObjectEntityFile(objectPath);
      const chunks: Buffer[] = [];
      for await (const chunk of objectFile.createReadStream()) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    },

    async downloadObject(objectFile: any, res: Response, cacheTtlSec = 3600) {
      return service.downloadObject(objectFile, res, cacheTtlSec);
    },

    normalizeObjectPath(rawPath: string) {
      return service.normalizeObjectEntityPath(rawPath);
    },

    async setAclPolicy(objectPath: string, aclPolicy: ObjectAclPolicy) {
      return service.trySetObjectEntityAclPolicy(objectPath, aclPolicy);
    },

    async canAccessObject({ userId, fileHandle }) {
      return service.canAccessObjectEntity({
        userId,
        objectFile: fileHandle,
      });
    },

    async fileExists(objectPath: string) {
      try {
        await service.getObjectEntityFile(objectPath);
        return true;
      } catch (error) {
        return false;
      }
    },
  };
}

async function createLocalAdapter(): Promise<StorageAdapter> {
  const { LocalStorageService } = await import("./local_storage");
  const fsPromises = await import("fs/promises");
  const service = new LocalStorageService();

  return {
    isPresignedUpload: () => false,

    async generateUploadPath() {
      const { objectId, filePath, objectPath } = await service.generateUploadPath();
      return { objectPath, uploadId: objectId };
    },

    async saveFile(objectPath: string, data: Buffer, contentType?: string) {
      return service.saveFile(objectPath, data, contentType);
    },

    async getFile(objectPath: string) {
      return service.getObjectFile(objectPath);
    },

    async getFileBuffer(objectPath: string) {
      const filePath = await service.getObjectFile(objectPath);
      return fsPromises.readFile(filePath);
    },

    async downloadObject(filePath: string, res: Response, cacheTtlSec = 3600) {
      return service.downloadObject(filePath, res, cacheTtlSec);
    },

    normalizeObjectPath(rawPath: string) {
      return service.normalizeObjectPath(rawPath);
    },

    async setAclPolicy(objectPath: string, aclPolicy: ObjectAclPolicy) {
      return service.trySetObjectAclPolicy(objectPath, aclPolicy);
    },

    async canAccessObject({ userId, fileHandle: filePath }) {
      return service.canAccessObjectFile({
        userId,
        filePath,
      });
    },

    async fileExists(objectPath: string) {
      return service.fileExists(objectPath);
    },
  };
}

export async function getStorageAdapter(): Promise<StorageAdapter> {
  if (adapter) {
    return adapter;
  }

  if (isReplitEnvironment()) {
    console.log("Using Replit Object Storage");
    adapter = await createReplitAdapter();
  } else {
    console.log("Using Local File Storage");
    adapter = await createLocalAdapter();
  }

  return adapter;
}

export type { StorageAdapter, ObjectAclPolicy };
