import type { APIRoute } from "astro";
import type { Subscriber } from "../../../lib/email/types.js";
import {
  EmailService,
  generateConfirmationToken,
  getTokenExpirationDate,
} from "../../../lib/email/service.js";

function createJsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function validateEmail(email: string | undefined): {
  isValid: boolean;
  email?: string;
} {
  const cleanedEmail = email?.toString()?.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!cleanedEmail || !emailRegex.test(cleanedEmail)) {
    return { isValid: false };
  }

  return { isValid: true, email: cleanedEmail };
}


async function handleEmailSendError(
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

async function sendConfirmationEmailWithHandling(
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



async function resendConfirmationEmail(
  email: string,
  token: string,
  env: any
): Promise<Response> {
  return sendConfirmationEmailWithHandling(
    email,
    token,
    env,
    undefined,
    "Confirmation email has been resent. Please check your inbox."
  );
}

async function createAndStoreNewSubscriber(
  email: string,
  request: Request,
  kv: any
): Promise<string> {
  const confirmationToken = generateConfirmationToken();
  const tokenExpiresAt = getTokenExpirationDate();

  const subscriber: Subscriber = {
    email,
    subscribedAt: new Date().toISOString(),
    status: "pending",
    confirmationToken,
    tokenExpiresAt,
    userAgent: request.headers.get("user-agent") || undefined,
    ip: request.headers.get("cf-connecting-ip") || undefined,
  };

  await kv.put(`subscriber:${email}`, JSON.stringify(subscriber));
  return confirmationToken;
}

async function handleExistingSubscriber(
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
      email,
      existingSubscriber.confirmationToken!,
      env
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

async function validateAndSetupSubscription(
  request: Request,
  locals: any
): Promise<{ email: string; kv: any } | Response> {
  const formData = await request.formData();
  const emailInput = formData.get("email");

  const { isValid, email } = validateEmail(emailInput?.toString());
  if (!isValid) {
    return createJsonResponse(
      {
        success: false,
        message: "Please enter a valid email address",
      },
      400
    );
  }

  const kv = locals.runtime?.env?.NEWSLETTER_KV;
  if (!kv) {
    console.error("KV namespace not available");
    return createJsonResponse(
      {
        success: false,
        message: "Service temporarily unavailable",
      },
      503
    );
  }

  return { email: email!, kv };
}

async function createNewSubscriber(
  email: string,
  request: Request,
  kv: any,
  env: any
): Promise<Response> {
  const confirmationToken = await createAndStoreNewSubscriber(
    email,
    request,
    kv
  );
  console.log("New subscription pending confirmation:", email);

  return sendConfirmationEmailWithHandling(
    email,
    confirmationToken,
    env,
    kv,
    "Please check your email to confirm your subscription! 📧"
  );
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const validation = await validateAndSetupSubscription(request, locals);
    if (validation instanceof Response) {
      return validation;
    }

    const { email, kv } = validation;
    const existingSubscriber = (await kv.get(
      `subscriber:${email}`,
      "json"
    )) as Subscriber | null;

    if (existingSubscriber) {
      return handleExistingSubscriber(
        email,
        existingSubscriber,
        locals.runtime.env
      );
    }

    return createNewSubscriber(email, request, kv, locals.runtime.env);
  } catch (error) {
    console.error("Subscription error:", error);
    return createJsonResponse(
      {
        success: false,
        message: "Subscription failed. Please try again.",
      },
      500
    );
  }
};
