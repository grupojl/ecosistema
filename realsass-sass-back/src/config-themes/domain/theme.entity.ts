export interface ThemeConfig {
  id:             string;
  organizationId: string;
  name:           string;
  primaryColor:   string | null;
  secondaryColor: string | null;
  accentColor:    string | null;
  fontFamily:     string | null;
  borderRadius:   string | null;
  logoUrl:        string | null;
  faviconUrl:     string | null;
  darkMode:       boolean;
  customCSS:      string | null;
  isSystemDefault: boolean;
  isActive:       boolean;
  createdAt:      Date;
  updatedAt:      Date;
}

export interface CreateThemeInput {
  organizationId: string;
  name:           string;
  primaryColor?:  string;
  secondaryColor?: string;
  accentColor?:   string;
  fontFamily?:    string;
  borderRadius?:  string;
  logoUrl?:       string;
  faviconUrl?:    string;
  darkMode?:      boolean;
  customCSS?:     string;
}
