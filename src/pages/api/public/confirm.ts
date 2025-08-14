import type { APIRoute } from "astro";
import {
  createErrorResponse,
  createSuccessResponse,
  validateKVAccess,
  findAndValidateSubscriberByToken,
  confirmSubscriber,
  sendWelcomeEmailSafely,
} from "../../../lib/api-utils.js";

export const GET: APIRoute = async ({ request, locals, url }) => {
  try {
    const token = url.searchParams.get("token");
    if (!token) {
      return createErrorResponse("Confirmation token is required");
    }

    const kv = locals.runtime?.env?.NEWSLETTER_KV;
    const kvError = validateKVAccess(kv);
    if (kvError) return kvError;

    const {
      subscriber: targetSubscriber,
      email: targetEmail,
      error,
    } = await findAndValidateSubscriberByToken(kv, token);
    if (error) return error;
    if (!targetSubscriber || !targetEmail) {
      return createErrorResponse("Invalid confirmation token");
    }

    await confirmSubscriber(kv, targetSubscriber, targetEmail);
    await sendWelcomeEmailSafely(locals.runtime.env, targetEmail);

    console.log("Subscription confirmed:", targetEmail);
    return createSuccessResponse(
      "Email confirmed successfully! Welcome to our newsletter! 🎉",
      { email: targetEmail }
    );
  } catch (error) {
    console.error("Confirmation error:", error);
    return createErrorResponse("Confirmation failed. Please try again.", 500);
  }
};

