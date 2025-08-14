/// <reference path="../.astro/types.d.ts" />
/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  NEWSLETTER_KV: KVNamespace;
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