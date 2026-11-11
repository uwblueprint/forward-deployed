/**
 * Public API Barrel for auth feature module.
 * EXPORT ONLY: Components, hooks, schemas, and types intended for external consumption.
 * DO NOT export internal sub-components or route-specific logic.
 */

export { signInWithEmail, signOut, signOutAction, signUpWithEmail } from "./api";
export type { AuthError, AuthResult, AuthSessionData } from "./api";
export { loginSchema, registerSchema } from "./schemas";
export type { LoginInput, RegisterInput } from "./schemas";
export type { Role, RoleResolver } from "./api";
export {
  getUserRole,
  isProtectedPath,
  requireRole,
  requireRoleForRoute,
} from "./api";
