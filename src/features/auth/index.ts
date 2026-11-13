/**
 * Public API Barrel for auth feature module.
 * EXPORT ONLY: Components, hooks, schemas, and types intended for external consumption.
 * DO NOT export internal sub-components or route-specific logic.
 */

export {
  requestPasswordReset,
  signInWithEmail,
  signOut,
  signOutAction,
  signUpWithEmail,
  updatePassword,
  verifyResetCode,
} from "./api";
export type { AuthError, AuthResult, AuthSessionData } from "./api";
export type { Role, RoleResolver } from "./api";
export {
  getUserRole,
  isProtectedPath,
  requireRole,
  requireRoleForRoute,
} from "./api";
export {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyResetCodeSchema,
} from "./schemas";
export type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyResetCodeInput,
} from "./schemas";
export { ForgotPasswordFlow } from "./components";
