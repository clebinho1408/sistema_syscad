import * as fs from "fs/promises";
import * as path from "path";

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
}

const ACL_SUFFIX = ".acl.json";

function getAclFilePath(filePath: string): string {
  return filePath + ACL_SUFFIX;
}

export async function setObjectAclPolicy(
  filePath: string,
  aclPolicy: ObjectAclPolicy
): Promise<void> {
  const aclPath = getAclFilePath(filePath);
  await fs.writeFile(aclPath, JSON.stringify(aclPolicy, null, 2), "utf-8");
}

export async function getObjectAclPolicy(
  filePath: string
): Promise<ObjectAclPolicy | null> {
  const aclPath = getAclFilePath(filePath);
  try {
    const data = await fs.readFile(aclPath, "utf-8");
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function canAccessObject({
  userId,
  filePath,
  requestedPermission,
}: {
  userId?: string;
  filePath: string;
  requestedPermission: ObjectPermission;
}): Promise<boolean> {
  const aclPolicy = await getObjectAclPolicy(filePath);
  if (!aclPolicy) {
    return false;
  }

  if (
    aclPolicy.visibility === "public" &&
    requestedPermission === ObjectPermission.READ
  ) {
    return true;
  }

  if (!userId) {
    return false;
  }

  if (aclPolicy.owner === userId) {
    return true;
  }

  return false;
}
