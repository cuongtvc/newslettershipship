/// <reference path="../.astro/types.d.ts" />
/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  NEWSLETTER_KV: KVNamespace;
  
  // Email Configuration
  EMAIL_PROVIDER?: string;
  FROM_EMAIL?: string;
  SITE_URL?: string;
  SITE_NAME?: string;
  
  // Resend
  RESEND_API_KEY?: string;
  
  // AWS SES
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_REGION?: string;
  
  // Postmark
  POSTMARK_SERVER_TOKEN?: string;
  
  // SendGrid
  SENDGRID_API_KEY?: string;
  
  // Mailgun
  MAILGUN_API_KEY?: string;
  MAILGUN_DOMAIN?: string;
}

declare namespace App {
  interface Locals {
    runtime: {
      env: CloudflareEnv;
      cf: CfProperties;
      ctx: ExecutionContext;
    };
  }
}