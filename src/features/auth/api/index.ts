export {
  requestPasswordReset,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  updatePassword,
  verifyResetCode,
} from "./auth";
export type { AuthError, AuthResult, AuthSessionData } from "./auth";
export type { Role, RoleResolver } from "./requireRole";
export { getUserRole, requireRole, requireRoleForRoute } from "./requireRole";
export { isProtectedPath } from "./session";
