export const PUBLIC_PROJECT_REPO_URL = 'https://github.com/dfki-dsa/pii-guardrail-browser-extension';

export const PUBLIC_PROJECT_LINKS = {
  repo: PUBLIC_PROJECT_REPO_URL,
  issues: `${PUBLIC_PROJECT_REPO_URL}/issues`,
  newIssue: `${PUBLIC_PROJECT_REPO_URL}/issues/new/choose`,
  privacy: `${PUBLIC_PROJECT_REPO_URL}/blob/main/PRIVACY.md`,
  security: `${PUBLIC_PROJECT_REPO_URL}/blob/main/SECURITY.md`,
  support: `${PUBLIC_PROJECT_REPO_URL}/blob/main/SUPPORT.md`,
  impressum: `${PUBLIC_PROJECT_REPO_URL}/blob/main/IMPRESSUM.md`,
  terms: `${PUBLIC_PROJECT_REPO_URL}/blob/main/TERMS.md`,
} as const;

/**
 * Terms of Use are not yet published (see issue 08). Until `TERMS.md` lands in
 * the public repo, the UI surfaces the Terms entry as a "coming soon"
 * placeholder rather than a working link. Flip to `true` once TERMS.md is live.
 */
export const TERMS_PUBLISHED = false;

export const SECURITY_SUPPORT_EMAIL = 'pii@dfki.de';

