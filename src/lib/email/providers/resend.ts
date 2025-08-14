import type {
  ConfirmationEmailParams,
  WelcomeEmailParams,
  EmailResult,
} from "../types.js";
import { BaseEmailProvider } from "./base.js";

export class ResendProvider extends BaseEmailProvider {
  readonly name = "resend";

  constructor(private config: { apiKey: string; fromEmail: string }) {
    super();
  }

  validateConfig(): boolean {
    return !!(this.config.apiKey && this.config.fromEmail);
  }

  protected async sendConfirmationEmailImpl(params: ConfirmationEmailParams): Promise<EmailResult> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.config.fromEmail,
        to: params.to,
        subject: this.buildConfirmationSubject(params.siteName),
        html: this.buildConfirmationTemplate(params),
      }),
    });

    const result = await response.json() as any;

    if (!response.ok) {
      console.error("Error when sending email", result);
      return {
        success: false,
        error: result.message || "Failed to send email",
        provider: this.name,
      };
    }

    return {
      success: true,
      messageId: result.id,
      provider: this.name,
    };
  }

  protected async sendWelcomeEmailImpl(params: WelcomeEmailParams): Promise<EmailResult> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.config.fromEmail,
        to: params.to,
        subject: this.buildWelcomeSubject(params.siteName),
        html: this.buildWelcomeTemplate(params),
      }),
    });

    const result = await response.json() as any;

    if (!response.ok) {
      console.error("Error when sending email", result);
      return {
        success: false,
        error: result.message || "Failed to send email",
        provider: this.name,
      };
    }

    return {
      success: true,
      messageId: result.id,
      provider: this.name,
    };
  }
}