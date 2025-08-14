import type { EmailProvider, ConfirmationEmailParams, WelcomeEmailParams, EmailResult } from '../types.js';

export class AWSSeSProvider implements EmailProvider {
  name = 'aws-ses';
  
  constructor(private config: { 
    accessKeyId: string; 
    secretAccessKey: string; 
    region: string; 
    fromEmail: string; 
  }) {}

  validateConfig(): boolean {
    return !!(
      this.config.accessKeyId && 
      this.config.secretAccessKey && 
      this.config.region && 
      this.config.fromEmail
    );
  }

  async sendConfirmationEmail(params: ConfirmationEmailParams): Promise<EmailResult> {
    try {
      const sesParams = {
        Source: this.config.fromEmail,
        Destination: {
          ToAddresses: [params.to],
        },
        Message: {
          Subject: {
            Data: `Confirm your subscription to ${params.siteName || 'our newsletter'}`,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: this.buildConfirmationTemplate(params),
              Charset: 'UTF-8',
            },
          },
        },
      };

      const result = await this.sendSESEmail(sesParams);
      return {
        success: true,
        messageId: result.MessageId,
        provider: this.name
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error', 
        provider: this.name 
      };
    }
  }

  async sendWelcomeEmail(params: WelcomeEmailParams): Promise<EmailResult> {
    try {
      const sesParams = {
        Source: this.config.fromEmail,
        Destination: {
          ToAddresses: [params.to],
        },
        Message: {
          Subject: {
            Data: `Welcome to ${params.siteName || 'our newsletter'}!`,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: this.buildWelcomeTemplate(params),
              Charset: 'UTF-8',
            },
          },
        },
      };

      const result = await this.sendSESEmail(sesParams);
      return {
        success: true,
        messageId: result.MessageId,
        provider: this.name
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error', 
        provider: this.name 
      };
    }
  }

  private async sendSESEmail(params: any): Promise<{ MessageId: string }> {
    const host = `email.${this.config.region}.amazonaws.com`;
    const service = 'ses';
    const method = 'POST';
    const url = `https://${host}/`;
    
    const payload = this.buildSESPayload(params);
    const headers = await this.buildAWSHeaders(method, url, payload, service);

    const response = await fetch(url, {
      method,
      headers,
      body: payload,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SES API error: ${response.status} ${errorText}`);
    }

    const responseText = await response.text();
    const messageIdMatch = responseText.match(/<MessageId>(.*?)<\/MessageId>/);
    
    if (!messageIdMatch) {
      throw new Error('Failed to parse MessageId from SES response');
    }

    return { MessageId: messageIdMatch[1] };
  }

  private buildSESPayload(params: any): string {
    const formData = new URLSearchParams();
    formData.append('Action', 'SendEmail');
    formData.append('Version', '2010-12-01');
    formData.append('Source', params.Source);
    formData.append('Destination.ToAddresses.member.1', params.Destination.ToAddresses[0]);
    formData.append('Message.Subject.Data', params.Message.Subject.Data);
    formData.append('Message.Subject.Charset', params.Message.Subject.Charset);
    formData.append('Message.Body.Html.Data', params.Message.Body.Html.Data);
    formData.append('Message.Body.Html.Charset', params.Message.Body.Html.Charset);
    
    return formData.toString();
  }

  private async buildAWSHeaders(method: string, url: string, payload: string, service: string): Promise<Record<string, string>> {
    const date = new Date();
    const dateStamp = date.toISOString().split('T')[0].replace(/-/g, '');
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Host': `email.${this.config.region}.amazonaws.com`,
      'X-Amz-Date': amzDate,
    };

    const signedHeaders = Object.keys(headers).map(k => k.toLowerCase()).sort().join(';');
    const canonicalHeaders = Object.keys(headers).sort()
      .map(k => `${k.toLowerCase()}:${headers[k]}\n`).join('');

    const payloadHash = await this.sha256(payload);
    
    const canonicalRequest = [
      method,
      '/',
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${this.config.region}/${service}/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      await this.sha256(canonicalRequest)
    ].join('\n');

    const signature = await this.getSignature(stringToSign, dateStamp, service);
    
    headers['Authorization'] = `${algorithm} Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    
    return headers;
  }

  private async sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async hmac(key: Uint8Array, message: string): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
    return new Uint8Array(signature);
  }

  private async getSignature(stringToSign: string, dateStamp: string, service: string): Promise<string> {
    const kDate = await this.hmac(new TextEncoder().encode(`AWS4${this.config.secretAccessKey}`), dateStamp);
    const kRegion = await this.hmac(kDate, this.config.region);
    const kService = await this.hmac(kRegion, service);
    const kSigning = await this.hmac(kService, 'aws4_request');
    const signature = await this.hmac(kSigning, stringToSign);
    
    return Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join('');
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
          <p style="color: #666; font-size: 16px;">Thanks for subscribing to ${params.siteName || 'our newsletter'}!</p>
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
          <h1 style="color: #333; margin-bottom: 10px;">Welcome to ${params.siteName || 'our newsletter'}! 🎉</h1>
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