import type { ConfirmationEmailParams, WelcomeEmailParams, EmailResult } from '../types.js';
import { BaseEmailProvider } from './base.js';

export class PostmarkProvider extends BaseEmailProvider {
  readonly name = 'postmark';
  
  constructor(private config: { serverToken: string; fromEmail: string }) {
    super();
  }

  validateConfig(): boolean {
    return !!(this.config.serverToken && this.config.fromEmail);
  }

  protected async sendConfirmationEmailImpl(params: ConfirmationEmailParams): Promise<EmailResult> {
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': this.config.serverToken,
      },
      body: JSON.stringify({
        From: this.config.fromEmail,
        To: params.to,
        Subject: this.buildConfirmationSubject(params.siteName),
        HtmlBody: this.buildConfirmationTemplate(params),
      }),
    });

    const result = await response.json() as any;
    
    if (!response.ok) {
      return {
        success: false,
        error: result.Message || 'Failed to send email',
        provider: this.name
      };
    }

    return {
      success: true,
      messageId: result.MessageID,
      provider: this.name
    };
  }

  protected async sendWelcomeEmailImpl(params: WelcomeEmailParams): Promise<EmailResult> {
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': this.config.serverToken,
      },
      body: JSON.stringify({
        From: this.config.fromEmail,
        To: params.to,
        Subject: this.buildWelcomeSubject(params.siteName),
        HtmlBody: this.buildWelcomeTemplate(params),
      }),
    });

    const result = await response.json() as any;
    
    if (!response.ok) {
      return {
        success: false,
        error: result.Message || 'Failed to send email',
        provider: this.name
      };
    }

    return {
      success: true,
      messageId: result.MessageID,
      provider: this.name
    };
  }
}