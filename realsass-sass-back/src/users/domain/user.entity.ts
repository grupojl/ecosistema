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
}

export interface UserProfile {
  user:            User;
  /** Organización por defecto (la más antigua que posee). Se mantiene por compatibilidad. */
  organization:    OrganizationSummary | null;
  /** D3: todas las organizaciones de las que el usuario es dueño. */
  organizations:   OrganizationSummary[];
  collaborations:  Array<{ organizationId: string; role: string; permissions: Record<string, boolean> }>;
}

export interface UpsertUserInput {
  firebaseUid:  string;
  email?:       string;
  displayName?: string;
  photoUrl?:    string;
  referredByCode?: string;
}
