export interface AffiliateProfile {
  id:             string;
  userId:         string;
  referralCode:   string;
  balance:        number;
  referralCount:  number;
  createdAt:      Date;
  updatedAt:      Date;
}

export interface AffiliateReferral {
  id:          string;
  firebaseUid: string;
  email:       string | null;
  createdAt:   Date;
}
