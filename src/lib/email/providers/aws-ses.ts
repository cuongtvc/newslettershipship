import type { ConfirmationEmailParams, WelcomeEmailParams, EmailResult } from '../types.js';
import { BaseEmailProvider } from './base.js';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

export class AWSSeSProvider extends BaseEmailProvider {
  readonly name = 'aws-ses';
  private sesClient: SESClient;
  
  constructor(private config: { 
    accessKeyId: string; 
    secretAccessKey: string; 
    region: string; 
    fromEmail: string; 
  }) {
    super();
    this.sesClient = new SESClient({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
  }

  validateConfig(): boolean {
    return !!(
      this.config.accessKeyId && 
      this.config.secretAccessKey && 
      this.config.region && 
      this.config.fromEmail
    );
  }

  protected async sendConfirmationEmailImpl(params: ConfirmationEmailParams): Promise<EmailResult> {
    try {
      const command = new SendEmailCommand({
        Source: this.config.fromEmail,
        Destination: {
          ToAddresses: [params.to],
        },
        Message: {
          Subject: {
            Data: this.buildConfirmationSubject(params.siteName),
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: this.buildConfirmationTemplate(params),
              Charset: 'UTF-8',
            },
          },
        },
      });

      const result = await this.sesClient.send(command);
      
      return {
        success: true,
        messageId: result.MessageId,
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
      const command = new SendEmailCommand({
        Source: this.config.fromEmail,
        Destination: {
          ToAddresses: [params.to],
        },
        Message: {
          Subject: {
            Data: this.buildWelcomeSubject(params.siteName),
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: this.buildWelcomeTemplate(params),
              Charset: 'UTF-8',
            },
          },
        },
      });

      const result = await this.sesClient.send(command);
      
      return {
        success: true,
        messageId: result.MessageId,
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