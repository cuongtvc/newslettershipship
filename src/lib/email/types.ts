export interface EmailProvider {
  name: string;
  sendConfirmationEmail(params: ConfirmationEmailParams): Promise<EmailResult>;
  sendWelcomeEmail(params: WelcomeEmailParams): Promise<EmailResult>;
  validateConfig(): boolean;
}

export interface ConfirmationEmailParams {
  to: string;
  confirmationUrl: string;
  siteName?: string;
}

export interface WelcomeEmailParams {
  to: string;
  siteName?: string;
  unsubscribeUrl?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

export interface Subscriber {
  email: string;
  subscribedAt: string;
  status: "pending" | "active" | "unsubscribed";
  confirmationToken?: string;
  tokenExpiresAt?: string;
  confirmedAt?: string;
  unsubscribeToken?: string;
  userAgent?: string;
  ip?: string;
}

export interface EmailProviderConfig {
  resend?: {
    apiKey: string;
    fromEmail: string;
  };
  'aws-ses'?: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    fromEmail: string;
  };
  postmark?: {
    serverToken: string;
    fromEmail: string;
  };
  sendgrid?: {
    apiKey: string;
    fromEmail: string;
  };
  mailgun?: {
    apiKey: string;
    domain: string;
    fromEmail: string;
  };
}