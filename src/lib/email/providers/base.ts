import type {
  EmailProvider,
  ConfirmationEmailParams,
  WelcomeEmailParams,
  NewsletterEmailParams,
  EmailResult,
} from "../types.js";
import { buildConfirmationTemplate, buildWelcomeTemplate, buildNewsletterTemplate } from "../templates.js";

export abstract class BaseEmailProvider implements EmailProvider {
  abstract readonly name: string;

  abstract validateConfig(): boolean;

  protected buildConfirmationTemplate(params: ConfirmationEmailParams): string {
    return buildConfirmationTemplate(params);
  }

  protected buildWelcomeTemplate(params: WelcomeEmailParams): string {
    return buildWelcomeTemplate(params);
  }

  protected buildNewsletterTemplate(params: NewsletterEmailParams): string {
    return buildNewsletterTemplate({
      subject: params.subject,
      content: params.content,
      unsubscribeUrl: params.unsubscribeUrl,
      siteName: params.siteName
    });
  }

  protected handleError(error: unknown): EmailResult {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      provider: this.name,
    };
  }

  protected buildConfirmationSubject(siteName?: string): string {
    return `Confirm your subscription to ${siteName || "our newsletter"}`;
  }

  protected buildWelcomeSubject(siteName?: string): string {
    return `Welcome to ${siteName || "our newsletter"}!`;
  }

  async sendConfirmationEmail(params: ConfirmationEmailParams): Promise<EmailResult> {
    try {
      return await this.sendConfirmationEmailImpl(params);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async sendWelcomeEmail(params: WelcomeEmailParams): Promise<EmailResult> {
    try {
      return await this.sendWelcomeEmailImpl(params);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async sendNewsletter(params: NewsletterEmailParams): Promise<EmailResult> {
    try {
      return await this.sendNewsletterImpl(params);
    } catch (error) {
      return this.handleError(error);
    }
  }

  protected abstract sendConfirmationEmailImpl(params: ConfirmationEmailParams): Promise<EmailResult>;
  protected abstract sendWelcomeEmailImpl(params: WelcomeEmailParams): Promise<EmailResult>;
  protected abstract sendNewsletterImpl(params: NewsletterEmailParams): Promise<EmailResult>;
}