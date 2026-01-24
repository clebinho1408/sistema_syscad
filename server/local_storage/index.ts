export {
  LocalStorageService,
  ObjectNotFoundError,
} from "./localStorageService";

export type {
  ObjectAclPolicy,
  ObjectPermission,
} from "./localAcl";

export {
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./localAcl";
