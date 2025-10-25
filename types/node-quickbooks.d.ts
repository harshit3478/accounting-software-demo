declare module 'node-quickbooks' {
  class QuickBooks {
    constructor(
      consumerKey: string,
      consumerSecret: string,
      accessToken: string,
      tokenSecret: boolean,
      realmId: string,
      useSandbox: boolean,
      debug: boolean,
      minorversion: number | null,
      oauthversion: string,
      refreshToken: string
    );

    static authorizeUrl(params: { clientId: string; redirectUri: string; state: string }, environment: string): string;
    
    static createToken(
      redirectUri: string,
      code: string,
      clientId: string,
      clientSecret: string,
      callback: (err: any, response: any) => void
    ): void;

    refreshAccessToken(callback: (err: any, response: any) => void): void;
    
    // Add other methods as needed
    getPayment(id: string, callback: (err: any, payment: any) => void): void;
    findPayments(criteria: any, callback: (err: any, payments: any) => void): void;
  }

  export = QuickBooks;
}
