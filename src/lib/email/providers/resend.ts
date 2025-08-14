import type {
  EmailProvider,
  ConfirmationEmailParams,
  WelcomeEmailParams,
  EmailResult,
} from "../types.js";

export class ResendProvider implements EmailProvider {
  name = "resend";

  constructor(private config: { apiKey: string; fromEmail: string }) {}

  validateConfig(): boolean {
    return !!(this.config.apiKey && this.config.fromEmail);
  }

  async sendConfirmationEmail(
    params: ConfirmationEmailParams
  ): Promise<EmailResult> {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.config.fromEmail,
          to: params.to,
          subject: `Confirm your subscription to ${
            params.siteName || "our newsletter"
          }`,
          html: this.buildConfirmationTemplate(params),
        }),
      });

      const result = await response.json();

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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        provider: this.name,
      };
    }
  }

  async sendWelcomeEmail(params: WelcomeEmailParams): Promise<EmailResult> {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.config.fromEmail,
          to: params.to,
          subject: `Welcome to ${params.siteName || "our newsletter"}!`,
          html: this.buildWelcomeTemplate(params),
        }),
      });

      const result = await response.json();

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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        provider: this.name,
      };
    }
  }

  private buildConfirmationTemplate(params: ConfirmationEmailParams): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirm Your Subscription</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin-bottom: 10px;">Confirm Your Subscription</h1>
          <p style="color: #666; font-size: 16px;">Thanks for subscribing to ${
            params.siteName || "our newsletter"
          }!</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
          <p style="margin: 0; color: #333;">
            To complete your subscription and start receiving our newsletter, please click the button below:
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${params.confirmationUrl}" 
             style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Confirm Subscription
          </a>
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
          <p style="color: #666; font-size: 14px; margin: 0;">
            If you didn't subscribe to this newsletter, you can safely ignore this email.
          </p>
          <p style="color: #666; font-size: 14px; margin: 5px 0 0 0;">
            This confirmation link will expire in 24 hours.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  private buildWelcomeTemplate(params: WelcomeEmailParams): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome!</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin-bottom: 10px;">Welcome to ${
            params.siteName || "our newsletter"
          }! 🎉</h1>
          <p style="color: #666; font-size: 16px;">Your subscription has been confirmed successfully.</p>
        </div>
        
        <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #28a745;">
          <p style="margin: 0; color: #155724;">
            Thank you for confirming your email address. You're now subscribed and will receive our latest updates!
          </p>
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
          <p style="color: #666; font-size: 14px; margin: 0;">
            Thanks for joining us! We're excited to share great content with you.
          </p>
        </div>
      </body>
      </html>
    `;
  }
}
