import type { Subscriber } from "./email/types.js";
import {
  isTokenExpired,
  EmailService,
  generateConfirmationToken,
  getTokenExpirationDate,
} from "./email/service.js";

export interface APIResponse {
  success: boolean;
  message: string;
  [key: string]: any;
}

export function createJsonResponse(
  data: APIResponse,
  status: number = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function createErrorResponse(
  message: string,
  status: number = 400
): Response {
  return createJsonResponse({ success: false, message }, status);
}

export function createSuccessResponse(
  message: string,
  data?: Record<string, any>
): Response {
  return createJsonResponse({ success: true, message, ...data });
}

export function validateKVAccess(kv: any): Response | null {
  if (!kv) {
    console.error("KV namespace not available");
    return createErrorResponse("Service temporarily unavailable", 503);
  }
  return null;
}

export function validateEmail(email: string | undefined): {
  valid: boolean;
  email?: string;
  error?: Response;
} {
  const cleanedEmail = email?.toString()?.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!cleanedEmail || !emailRegex.test(cleanedEmail)) {
    return {
      valid: false,
      error: createErrorResponse("Please enter a valid email address"),
    };
  }

  return { valid: true, email: cleanedEmail };
}

export async function findAndValidateSubscriberByToken(
  kv: any,
  token: string
): Promise<{
  subscriber: Subscriber | null;
  email: string | null;
  error: Response | null;
}> {
  const allKeys = await kv.list({ prefix: "subscriber:" });

  for (const key of allKeys.keys) {
    const subscriber = (await kv.get(key.name, "json")) as Subscriber;
    if (subscriber && subscriber.confirmationToken === token) {
      if (
        subscriber.tokenExpiresAt &&
        isTokenExpired(subscriber.tokenExpiresAt)
      ) {
        return {
          subscriber: null,
          email: null,
          error: createErrorResponse(
            "Confirmation token has expired. Please subscribe again."
          ),
        };
      }
      return { subscriber, email: subscriber.email, error: null };
    }
  }

  return { subscriber: null, email: null, error: null };
}

export async function confirmSubscriber(
  kv: any,
  subscriber: Subscriber,
  email: string
): Promise<void> {
  subscriber.status = "active";
  subscriber.confirmedAt = new Date().toISOString();
  delete subscriber.confirmationToken;
  delete subscriber.tokenExpiresAt;
  
  // Ensure unsubscribe token exists for confirmed subscribers
  if (!subscriber.unsubscribeToken) {
    subscriber.unsubscribeToken = generateUnsubscribeToken();
  }

  await kv.put(`subscriber:${email}`, JSON.stringify(subscriber));

  const currentCount = (await kv.get("subscriber_count")) || "0";
  await kv.put("subscriber_count", (parseInt(currentCount) + 1).toString());
}

export async function sendWelcomeEmailSafely(
  env: any,
  email: string,
  unsubscribeToken?: string
): Promise<void> {
  try {
    const emailService = new EmailService(env);
    const result = await emailService.sendWelcomeEmail(email, unsubscribeToken);

    if (!result.success) {
      console.error(
        `Failed to send welcome email (${result.provider}):`,
        result.error
      );
    }
  } catch (error) {
    console.error("Error sending welcome email:", error);
  }
}

export async function handleEmailSendError(
  email: string,
  kv: any | undefined,
  error: any,
  provider?: string
): Promise<Response> {
  const logMessage = provider
    ? `Failed to send confirmation email (${provider}):`
    : "Error sending confirmation email:";

  console.error(logMessage, error);
  if (kv) await kv.delete(`subscriber:${email}`);

  return createJsonResponse(
    {
      success: false,
      message: "Failed to send confirmation email. Please try again.",
    },
    500
  );
}

export async function sendConfirmationEmailWithHandling(
  email: string,
  token: string,
  env: any,
  kv?: any,
  successMessage: string = "Confirmation email sent. Please check your inbox."
): Promise<Response> {
  try {
    const emailService = new EmailService(env);
    const result = await emailService.sendConfirmationEmail(email, token);

    if (!result.success) {
      return handleEmailSendError(email, kv, result.error, result.provider);
    }

    return createJsonResponse({
      success: true,
      message: successMessage,
    });
  } catch (error) {
    return handleEmailSendError(email, kv, error);
  }
}

export async function resendConfirmationEmail(
  env: any,
  email: string,
  token: string
): Promise<Response> {
  return sendConfirmationEmailWithHandling(
    email,
    token,
    env,
    undefined,
    "Confirmation email has been resent. Please check your inbox."
  );
}

export function generateUnsubscribeToken(): string {
  return generateConfirmationToken();
}

export async function createAndStoreNewSubscriber(
  email: string,
  request: Request,
  kv: any
): Promise<string> {
  const confirmationToken = generateConfirmationToken();
  const unsubscribeToken = generateUnsubscribeToken();
  const tokenExpiresAt = getTokenExpirationDate();

  const subscriber: Subscriber = {
    email,
    subscribedAt: new Date().toISOString(),
    status: "pending",
    confirmationToken,
    tokenExpiresAt,
    unsubscribeToken,
    userAgent: request.headers.get("user-agent") || undefined,
    ip: request.headers.get("cf-connecting-ip") || undefined,
  };

  await kv.put(`subscriber:${email}`, JSON.stringify(subscriber));
  return confirmationToken;
}

export async function handleExistingSubscriber(
  email: string,
  existingSubscriber: Subscriber,
  env: any
): Promise<Response> {
  if (existingSubscriber.status === "active") {
    return createJsonResponse(
      {
        success: false,
        message: "This email is already subscribed to our newsletter",
      },
      409
    );
  } else if (existingSubscriber.status === "pending") {
    return resendConfirmationEmail(
      env,
      email,
      existingSubscriber.confirmationToken!
    );
  } else {
    return createJsonResponse(
      {
        success: false,
        message:
          "This email was previously unsubscribed. Please contact support to reactivate your subscription.",
      },
      403
    );
  }
}
