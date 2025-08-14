import type { EmailProvider, EmailProviderConfig } from './types.js';
import { ResendProvider } from './providers/resend.js';
import { AWSSeSProvider } from './providers/aws-ses.js';
import { PostmarkProvider } from './providers/postmark.js';
import { SendGridProvider } from './providers/sendgrid.js';
import { MailgunProvider } from './providers/mailgun.js';

export class EmailProviderFactory {
  static create(provider: string, config: EmailProviderConfig): EmailProvider {
    switch (provider.toLowerCase()) {
      case 'resend':
        if (!config.resend) throw new Error('Resend configuration missing');
        return new ResendProvider(config.resend);
      
      case 'aws-ses':
        if (!config['aws-ses']) throw new Error('AWS SES configuration missing');
        return new AWSSeSProvider(config['aws-ses']);
      
      case 'postmark':
        if (!config.postmark) throw new Error('Postmark configuration missing');
        return new PostmarkProvider(config.postmark);
      
      case 'sendgrid':
        if (!config.sendgrid) throw new Error('SendGrid configuration missing');
        return new SendGridProvider(config.sendgrid);
      
      case 'mailgun':
        if (!config.mailgun) throw new Error('Mailgun configuration missing');
        return new MailgunProvider(config.mailgun);
      
      default:
        throw new Error(`Unsupported email provider: ${provider}`);
    }
  }
  
  static getSupportedProviders(): string[] {
    return ['resend', 'aws-ses', 'postmark', 'sendgrid', 'mailgun'];
  }
}