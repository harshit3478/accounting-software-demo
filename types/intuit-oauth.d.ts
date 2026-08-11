declare module "intuit-oauth" {
  interface OAuthClientOptions {
    clientId: string;
    clientSecret: string;
    environment: string;
    redirectUri: string;
  }

  interface AuthorizeUriParams {
    scope: string[];
    state: string;
  }

  interface TokenJson {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    x_refresh_token_expires_in?: number;
    token_type?: string;
    [key: string]: unknown;
  }

  interface AuthResponse {
    getJson(): TokenJson;
  }

  class OAuthClient {
    static scopes: {
      Accounting: string;
      OpenId: string;
      Profile: string;
      Email: string;
      Phone: string;
      Address: string;
    };

    constructor(options: OAuthClientOptions);

    authorizeUri(params: AuthorizeUriParams): string;
    createToken(uri: string): Promise<AuthResponse>;
  }

  export = OAuthClient;
}
