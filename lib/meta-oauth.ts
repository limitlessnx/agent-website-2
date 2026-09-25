const DEFAULT_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
];

const ALLOWED_SCOPES = new Set(DEFAULT_SCOPES);

export function metaOauthScope() {
  const configuredScopes = String(process.env.META_OAUTH_SCOPES || "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
  const scopes = configuredScopes.filter((scope) => ALLOWED_SCOPES.has(scope));
  return (scopes.length ? scopes : DEFAULT_SCOPES).join(",");
}

export function buildMetaAuthorizationUrl(input: {
  apiVersion: string;
  appId: string;
  redirectUri: string;
  state: string;
  loginConfigurationId?: string;
}) {
  const authorization = new URL(
    `https://www.facebook.com/${input.apiVersion}/dialog/oauth`,
  );
  const loginConfigurationId = String(input.loginConfigurationId || "").trim();

  authorization.searchParams.set("client_id", input.appId);
  authorization.searchParams.set("redirect_uri", input.redirectUri);
  authorization.searchParams.set("state", input.state);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("auth_type", "rerequest");

  if (loginConfigurationId) {
    authorization.searchParams.set("config_id", loginConfigurationId);
    authorization.searchParams.set("override_default_response_type", "true");
  } else {
    authorization.searchParams.set("scope", metaOauthScope());
  }

  return authorization;
}
