import type { ConfirmationEmailParams, WelcomeEmailParams, EmailResult } from '../types.js';
import { BaseEmailProvider } from './base.js';

export class MailgunProvider extends BaseEmailProvider {
  readonly name = 'mailgun';
  
  constructor(private config: { apiKey: string; domain: string; fromEmail: string }) {
    super();
  }

  validateConfig(): boolean {
    return !!(this.config.apiKey && this.config.domain && this.config.fromEmail);
  }

  protected async sendConfirmationEmailImpl(params: ConfirmationEmailParams): Promise<EmailResult> {
    const formData = new FormData();
    formData.append('from', this.config.fromEmail);
    formData.append('to', params.to);
    formData.append('subject', this.buildConfirmationSubject(params.siteName));
    formData.append('html', this.buildConfirmationTemplate(params));

    const response = await fetch(`https://api.mailgun.net/v3/${this.config.domain}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`api:${this.config.apiKey}`)}`,
      },
      body: formData,
    });

    const result = await response.json() as any;
    
    if (!response.ok) {
      return {
        success: false,
        error: result.message || 'Failed to send email',
        provider: this.name
      };
    }

    return {
      success: true,
      messageId: result.id,
      provider: this.name
    };
  }

  protected async sendWelcomeEmailImpl(params: WelcomeEmailParams): Promise<EmailResult> {
    const formData = new FormData();
    formData.append('from', this.config.fromEmail);
    formData.append('to', params.to);
    formData.append('subject', this.buildWelcomeSubject(params.siteName));
    formData.append('html', this.buildWelcomeTemplate(params));

    const response = await fetch(`https://api.mailgun.net/v3/${this.config.domain}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`api:${this.config.apiKey}`)}`,
      },
      body: formData,
    });

    const result = await response.json() as any;
    
    if (!response.ok) {
      return {
        success: false,
        error: result.message || 'Failed to send email',
        provider: this.name
      };
    }

    return {
      success: true,
      messageId: result.id,
      provider: this.name
    };
  }
}