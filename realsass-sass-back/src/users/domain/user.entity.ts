export interface User {
  id:              string;
  firebaseUid:     string;
  email:           string | null;
  displayName:     string | null;
  photoUrl:        string | null;
  referralCode:    string | null;
  referredByCode:  string | null;
  createdAt:       Date;
  updatedAt:       Date;
}

export interface OrganizationSummary {
  id:   string;
  name: string | null;
  slug: string | null;
  description: string | null;
}

export interface UserProfile {
  user:            User;
  /** Organización por defecto (la más antigua que posee). Se mantiene por compatibilidad. */
  organization:    OrganizationSummary | null;
  /** D3: todas las organizaciones de las que el usuario es dueño. */
  organizations:   OrganizationSummary[];
  collaborations:  Array<{ organizationId: string; role: string; permissions: Record<string, boolean> }>;
}

/** Cuenta tal como la necesita el alta/sync: incluye isOwner y el código de afiliado. */
export interface UserAccount {
  id:            string;
  firebaseUid:   string;
  email:         string;
  displayName:   string | null;
  avatarUrl:     string | null;
  isOwner:       boolean;
  affiliateCode: string | null;
}

export interface CreateAccountInput {
  firebaseUid:   string;
  email:         string;
  displayName:   string | null;
  avatarUrl:     string | null;
  affiliateCode: string;
}

export type AccountPatch = Partial<Pick<UserAccount, 'displayName' | 'avatarUrl' | 'isOwner' | 'affiliateCode'>>;

/** Qué puede abrir el usuario: organizaciones propias (de la más antigua) y colaboraciones ACTIVAS. */
export interface AccessSummary {
  email:               string;
  organizationIds:     string[];
  activeCollaborations: number;
}

export interface UpsertUserInput {
  firebaseUid:  string;
  email?:       string;
  displayName?: string;
  photoUrl?:    string;
  referredByCode?: string;
}
