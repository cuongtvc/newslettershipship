import type { ConfirmationEmailParams, WelcomeEmailParams, EmailResult } from '../types.js';
import { BaseEmailProvider } from './base.js';
import Mailgun from 'mailgun.js';
import formData from 'form-data';

export class MailgunProvider extends BaseEmailProvider {
  readonly name = 'mailgun';
  private mailgun: any;
  
  constructor(private config: { apiKey: string; domain: string; fromEmail: string }) {
    super();
    const mg = new Mailgun(formData);
    this.mailgun = mg.client({
      username: 'api',
      key: this.config.apiKey,
    });
  }

  validateConfig(): boolean {
    return !!(this.config.apiKey && this.config.domain && this.config.fromEmail);
  }

  protected async sendConfirmationEmailImpl(params: ConfirmationEmailParams): Promise<EmailResult> {
    try {
      const response = await this.mailgun.messages.create(this.config.domain, {
        from: this.config.fromEmail,
        to: params.to,
        subject: this.buildConfirmationSubject(params.siteName),
        html: this.buildConfirmationTemplate(params),
      });

      return {
        success: true,
        messageId: response.id,
        provider: this.name,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send email',
        provider: this.name,
      };
    }
  }

  protected async sendWelcomeEmailImpl(params: WelcomeEmailParams): Promise<EmailResult> {
    try {
      const response = await this.mailgun.messages.create(this.config.domain, {
        from: this.config.fromEmail,
        to: params.to,
        subject: this.buildWelcomeSubject(params.siteName),
        html: this.buildWelcomeTemplate(params),
      });

      return {
        success: true,
        messageId: response.id,
        provider: this.name,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send email',
        provider: this.name,
      };
    }
  }
}