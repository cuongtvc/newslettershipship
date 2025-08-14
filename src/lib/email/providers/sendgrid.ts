import type { ConfirmationEmailParams, WelcomeEmailParams, NewsletterEmailParams, EmailResult } from '../types.js';
import { BaseEmailProvider } from './base.js';
import sgMail from '@sendgrid/mail';

export class SendGridProvider extends BaseEmailProvider {
  readonly name = 'sendgrid';
  
  constructor(private config: { apiKey: string; fromEmail: string }) {
    super();
    sgMail.setApiKey(this.config.apiKey);
  }

  validateConfig(): boolean {
    return !!(this.config.apiKey && this.config.fromEmail);
  }

  protected async sendConfirmationEmailImpl(params: ConfirmationEmailParams): Promise<EmailResult> {
    try {
      const msg = {
        to: params.to,
        from: this.config.fromEmail,
        subject: this.buildConfirmationSubject(params.siteName),
        html: this.buildConfirmationTemplate(params),
      };

      const response = await sgMail.send(msg);
      
      return {
        success: true,
        messageId: response[0]?.headers?.['x-message-id'],
        provider: this.name,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.body?.errors?.[0]?.message || error.message || 'Failed to send email',
        provider: this.name,
      };
    }
  }

  protected async sendWelcomeEmailImpl(params: WelcomeEmailParams): Promise<EmailResult> {
    try {
      const msg = {
        to: params.to,
        from: this.config.fromEmail,
        subject: this.buildWelcomeSubject(params.siteName),
        html: this.buildWelcomeTemplate(params),
      };

      const response = await sgMail.send(msg);
      
      return {
        success: true,
        messageId: response[0]?.headers?.['x-message-id'],
        provider: this.name,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.body?.errors?.[0]?.message || error.message || 'Failed to send email',
        provider: this.name,
      };
    }
  }

  protected async sendNewsletterImpl(params: NewsletterEmailParams): Promise<EmailResult> {
    try {
      const msg = {
        to: params.to,
        from: this.config.fromEmail,
        subject: params.subject,
        html: this.buildNewsletterTemplate(params),
      };

      const response = await sgMail.send(msg);
      
      return {
        success: true,
        messageId: response[0]?.headers?.['x-message-id'],
        provider: this.name,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.body?.errors?.[0]?.message || error.message || 'Failed to send email',
        provider: this.name,
      };
    }
  }
}