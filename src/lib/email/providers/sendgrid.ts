import type { ConfirmationEmailParams, WelcomeEmailParams, EmailResult } from '../types.js';
import { BaseEmailProvider } from './base.js';

export class SendGridProvider extends BaseEmailProvider {
  readonly name = 'sendgrid';
  
  constructor(private config: { apiKey: string; fromEmail: string }) {
    super();
  }

  validateConfig(): boolean {
    return !!(this.config.apiKey && this.config.fromEmail);
  }

  protected async sendConfirmationEmailImpl(params: ConfirmationEmailParams): Promise<EmailResult> {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: params.to }],
          subject: this.buildConfirmationSubject(params.siteName),
        }],
        from: { email: this.config.fromEmail },
        content: [{
          type: 'text/html',
          value: this.buildConfirmationTemplate(params),
        }],
      }),
    });

    if (!response.ok) {
      const errorResult = await response.json() as any;
      return {
        success: false,
        error: errorResult.errors?.[0]?.message || 'Failed to send email',
        provider: this.name
      };
    }

    const messageId = response.headers.get('x-message-id');
    return {
      success: true,
      messageId: messageId || undefined,
      provider: this.name
    };
  }

  protected async sendWelcomeEmailImpl(params: WelcomeEmailParams): Promise<EmailResult> {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: params.to }],
          subject: this.buildWelcomeSubject(params.siteName),
        }],
        from: { email: this.config.fromEmail },
        content: [{
          type: 'text/html',
          value: this.buildWelcomeTemplate(params),
        }],
      }),
    });

    if (!response.ok) {
      const errorResult = await response.json() as any;
      return {
        success: false,
        error: errorResult.errors?.[0]?.message || 'Failed to send email',
        provider: this.name
      };
    }

    const messageId = response.headers.get('x-message-id');
    return {
      success: true,
      messageId: messageId || undefined,
      provider: this.name
    };
  }
}