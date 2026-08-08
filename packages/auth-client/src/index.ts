// Errors
export { AppError }       from './errors/app-error';
export type { AppErrorCode } from './errors/app-error';

// Types
export type {
  UserProfile, Organization, Tenant,
  AffiliateData, ApiEnvelope, TenantRole,
} from './types/index';

// Firebase
export {
  initFirebase, getIdToken,
  signInWithGoogle, signOut,
} from './firebase/firebase';
export type { FirebaseConfig } from './firebase/firebase';

// HTTP
export {
  apiFetch,
  setActiveOrganizationId,
  getActiveOrganizationId,
} from './http/api-fetch';

// React
export { AuthProvider, useAuth } from './react/auth-provider';
