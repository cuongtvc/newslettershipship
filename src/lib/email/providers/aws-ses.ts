import type { ConfirmationEmailParams, WelcomeEmailParams, EmailResult } from '../types.js';
import { BaseEmailProvider } from './base.js';

export class AWSSeSProvider extends BaseEmailProvider {
  readonly name = 'aws-ses';
  
  constructor(private config: { 
    accessKeyId: string; 
    secretAccessKey: string; 
    region: string; 
    fromEmail: string; 
  }) {
    super();
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
    const sesParams = {
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
    };

    const result = await this.sendSESEmail(sesParams);
    return {
      success: true,
      messageId: result.MessageId,
      provider: this.name
    };
  }

  protected async sendWelcomeEmailImpl(params: WelcomeEmailParams): Promise<EmailResult> {
    const sesParams = {
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
    };

    const result = await this.sendSESEmail(sesParams);
    return {
      success: true,
      messageId: result.MessageId,
      provider: this.name
    };
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
    const keyBuffer = key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer;
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
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
}