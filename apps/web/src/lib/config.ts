import { api } from './api';

export type PublicConfig = {
  env: string;
  beta: boolean;
  badgeOnPublic: boolean;
  googleClientId: string | null;
  features: {
    PLAYER_LOGIN: boolean;
    MATCH_ACCESS: boolean;
    CUSTOM_RULES: boolean;
    CUSTOM_MVP: boolean;
    PUBLIC_SHARE: boolean;
    BETA_FEEDBACK: boolean;
    GOOGLE_LOGIN: boolean;
  };
};

export function fetchPublicConfig() {
  return api<PublicConfig>('/api/v1/config', { auth: false });
}
