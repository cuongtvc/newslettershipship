import type { ConfirmationEmailParams, WelcomeEmailParams, EmailResult } from '../types.js';
import { BaseEmailProvider } from './base.js';
import { ServerClient } from 'postmark';

export class PostmarkProvider extends BaseEmailProvider {
  readonly name = 'postmark';
  private client: ServerClient;
  
  constructor(private config: { serverToken: string; fromEmail: string }) {
    super();
    this.client = new ServerClient(this.config.serverToken);
  }

  validateConfig(): boolean {
    return !!(this.config.serverToken && this.config.fromEmail);
  }

  protected async sendConfirmationEmailImpl(params: ConfirmationEmailParams): Promise<EmailResult> {
    try {
      const response = await this.client.sendEmail({
        From: this.config.fromEmail,
        To: params.to,
        Subject: this.buildConfirmationSubject(params.siteName),
        HtmlBody: this.buildConfirmationTemplate(params),
      });

      return {
        success: true,
        messageId: response.MessageID,
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
      const response = await this.client.sendEmail({
        From: this.config.fromEmail,
        To: params.to,
        Subject: this.buildWelcomeSubject(params.siteName),
        HtmlBody: this.buildWelcomeTemplate(params),
      });

      return {
        success: true,
        messageId: response.MessageID,
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