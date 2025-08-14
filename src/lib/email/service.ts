import type { EmailProvider, EmailResult, EmailProviderConfig } from './types.js';
import { EmailProviderFactory } from './factory.js';

export class EmailService {
  private provider: EmailProvider;
  private siteUrl: string;
  private siteName: string;

  constructor(env: any) {
    this.siteUrl = env.SITE_URL || 'http://localhost:4321';
    this.siteName = env.SITE_NAME || 'Newsletter';
    
    const providerName = env.EMAIL_PROVIDER || 'resend';
    this.provider = this.createProvider(providerName, env);
  }

  private createProvider(name: string, env: any): EmailProvider {
    const config: EmailProviderConfig = {};

    switch (name.toLowerCase()) {
      case 'resend':
        config.resend = {
          apiKey: env.RESEND_API_KEY,
          fromEmail: env.FROM_EMAIL,
        };
        break;
      
      case 'aws-ses':
        config['aws-ses'] = {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          region: env.AWS_REGION,
          fromEmail: env.FROM_EMAIL,
        };
        break;
      
      case 'postmark':
        config.postmark = {
          serverToken: env.POSTMARK_SERVER_TOKEN,
          fromEmail: env.FROM_EMAIL,
        };
        break;
      
      case 'sendgrid':
        config.sendgrid = {
          apiKey: env.SENDGRID_API_KEY,
          fromEmail: env.FROM_EMAIL,
        };
        break;
      
      case 'mailgun':
        config.mailgun = {
          apiKey: env.MAILGUN_API_KEY,
          domain: env.MAILGUN_DOMAIN,
          fromEmail: env.FROM_EMAIL,
        };
        break;
      
      default:
        throw new Error(`Unsupported email provider: ${name}`);
    }

    const provider = EmailProviderFactory.create(name, config);
    
    if (!provider.validateConfig()) {
      throw new Error(`Invalid configuration for ${name} email provider`);
    }

    return provider;
  }

  async sendConfirmationEmail(email: string, token: string): Promise<EmailResult> {
    const confirmationUrl = `${this.siteUrl}/confirm?token=${token}`;
    
    return this.provider.sendConfirmationEmail({
      to: email,
      confirmationUrl,
      siteName: this.siteName,
    });
  }

  async sendWelcomeEmail(email: string): Promise<EmailResult> {
    return this.provider.sendWelcomeEmail({
      to: email,
      siteName: this.siteName,
    });
  }

  getProviderName(): string {
    return this.provider.name;
  }
}

export function generateConfirmationToken(): string {
  return crypto.randomUUID();
}

export function getTokenExpirationDate(): string {
  const expirationDate = new Date();
  expirationDate.setHours(expirationDate.getHours() + 24); // 24 hours from now
  return expirationDate.toISOString();
}

export function isTokenExpired(tokenExpiresAt: string): boolean {
  const expirationDate = new Date(tokenExpiresAt);
  const now = new Date();
  return now > expirationDate;
}