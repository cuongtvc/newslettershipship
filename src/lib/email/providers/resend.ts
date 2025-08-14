import type {
  ConfirmationEmailParams,
  WelcomeEmailParams,
  NewsletterEmailParams,
  EmailResult,
} from "../types.js";
import { BaseEmailProvider } from "./base.js";
import { Resend } from "resend";

export class ResendProvider extends BaseEmailProvider {
  readonly name = "resend";
  private resend: Resend;

  constructor(private config: { apiKey: string; fromEmail: string }) {
    super();
    this.resend = new Resend(this.config.apiKey);
  }

  validateConfig(): boolean {
    return !!(this.config.apiKey && this.config.fromEmail);
  }

  protected async sendConfirmationEmailImpl(params: ConfirmationEmailParams): Promise<EmailResult> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.fromEmail,
        to: params.to,
        subject: this.buildConfirmationSubject(params.siteName),
        html: this.buildConfirmationTemplate(params),
      });

      if (error) {
        return {
          success: false,
          error: error.message,
          provider: this.name,
        };
      }

      return {
        success: true,
        messageId: data?.id,
        provider: this.name,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  protected async sendWelcomeEmailImpl(params: WelcomeEmailParams): Promise<EmailResult> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.fromEmail,
        to: params.to,
        subject: this.buildWelcomeSubject(params.siteName),
        html: this.buildWelcomeTemplate(params),
      });

      if (error) {
        return {
          success: false,
          error: error.message,
          provider: this.name,
        };
      }

      return {
        success: true,
        messageId: data?.id,
        provider: this.name,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  protected async sendNewsletterImpl(params: NewsletterEmailParams): Promise<EmailResult> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.fromEmail,
        to: params.to,
        subject: params.subject,
        html: this.buildNewsletterTemplate(params),
      });

      if (error) {
        return {
          success: false,
          error: error.message,
          provider: this.name,
        };
      }

      return {
        success: true,
        messageId: data?.id,
        provider: this.name,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
}