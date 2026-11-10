export { signInWithEmail, signOut, signUpWithEmail } from "./auth";
export type { AuthError, AuthResult, AuthSessionData } from "./auth";
export type { Role, RoleResolver } from "./requireRole";
export { getUserRole, requireRole, requireRoleForRoute } from "./requireRole";
export { isProtectedPath } from "./session";
