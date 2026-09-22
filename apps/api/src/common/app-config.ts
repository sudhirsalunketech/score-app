export function appEnv() {
  return (process.env.APP_ENV || process.env.NODE_ENV || 'development').toLowerCase();
}

export function isBetaEnv() {
  return appEnv() === 'beta' || process.env.BETA === 'true' || process.env.BETA === '1';
}

export function badgeOnPublic() {
  return process.env.BETA_BADGE_PUBLIC === 'true' || process.env.BETA_BADGE_PUBLIC === '1';
}

export function publicConfig() {
  const beta = isBetaEnv();
  const production = appEnv() === 'production' || process.env.NODE_ENV === 'production';
  const googleClientId = process.env.GOOGLE_CLIENT_ID || null;
  return {
    env: appEnv(),
    beta,
    badgeOnPublic: beta && badgeOnPublic(),
    googleClientId,
    features: {
      PLAYER_LOGIN: true,
      MATCH_ACCESS: true,
      CUSTOM_RULES: true,
      CUSTOM_MVP: true,
      PUBLIC_SHARE: true,
      BETA_FEEDBACK: beta,
      GOOGLE_LOGIN: Boolean(googleClientId),
    },
    devAuthHints: !production && process.env.APP_ENV !== 'beta',
  };
}

export function denyMessage(permission: string) {
  switch (permission) {
    case 'MATCH_SCORE':
      return "You don't have permission to score this match.";
    case 'MATCH_UNDO':
      return "You don't have permission to undo.";
    case 'MATCH_EDIT':
      return "You don't have permission to edit this match.";
    case 'MATCH_DELETE':
      return "You don't have permission to delete this match.";
    case 'USER_MANAGE_ACCESS':
    case 'USER_INVITE':
      return "You don't have permission to manage access.";
    case 'TOURNAMENT_MANAGE_RULES':
      return "You don't have permission to change tournament rules.";
    case 'FAN_MANAGE':
      return "You don't have permission to manage fan engagement.";
    default:
      return "You don't have permission.";
  }
}
