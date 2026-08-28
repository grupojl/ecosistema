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

export interface UserProfile {
  user:            User;
  organization:    { id: string; name: string | null; slug: string | null } | null;
  collaborations:  Array<{ organizationId: string; role: string; permissions: Record<string, boolean> }>;
}

export interface UpsertUserInput {
  firebaseUid:  string;
  email?:       string;
  displayName?: string;
  photoUrl?:    string;
  referredByCode?: string;
}
