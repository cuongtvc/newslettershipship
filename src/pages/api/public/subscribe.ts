import type { APIRoute } from "astro";
import type { Subscriber } from "../../../lib/email/types.js";
import {
  createJsonResponse,
  validateEmail,
  validateKVAccess,
  handleExistingSubscriber,
  createAndStoreNewSubscriber,
  sendConfirmationEmailWithHandling,
} from "../../../lib/api-utils.js";

async function validateAndSetupSubscription(
  request: Request,
  locals: any
): Promise<{ email: string; kv: any } | Response> {
  const formData = await request.formData();
  const emailInput = formData.get("email");

  const { valid, email } = validateEmail(emailInput?.toString());
  if (!valid) {
    return createJsonResponse(
      {
        success: false,
        message: "Please enter a valid email address",
      },
      400
    );
  }

  const kv = locals.runtime?.env?.NEWSLETTER_KV;
  const kvError = validateKVAccess(kv);
  if (kvError) return kvError;

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
