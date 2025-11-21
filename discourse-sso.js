/**
 * Discourse SSO (DiscourseConnect) Integration Utilities
 *
 * This module handles Single Sign-On integration between Commonry and Discourse forum.
 * It implements Discourse's SSO protocol using HMAC-SHA256 for secure authentication.
 *
 * @see https://meta.discourse.org/t/discourseconnect-official-single-sign-on-for-discourse-sso/13045
 */

import crypto from "crypto";

/**
 * Validates the incoming SSO payload signature from Discourse
 *
 * @param {string} payload - The base64-encoded SSO payload from Discourse
 * @param {string} signature - The HMAC-SHA256 signature to validate
 * @param {string} secret - The shared SSO secret configured in Discourse
 * @returns {boolean} - True if signature is valid
 */
export function validateDiscourseSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSignature, "hex"),
  );
}

/**
 * Parses the incoming SSO payload from Discourse
 *
 * @param {string} payload - The base64-encoded SSO payload
 * @returns {Object} - Decoded SSO parameters including nonce and return_sso_url
 */
export function parseDiscoursePayload(payload) {
  const decoded = Buffer.from(payload, "base64").toString("utf8");
  const params = new URLSearchParams(decoded);

  return {
    nonce: params.get("nonce"),
    return_sso_url: params.get("return_sso_url"),
  };
}

/**
 * Generates the SSO response payload for Discourse with user information
 *
 * @param {Object} user - The authenticated Commonry user object
 * @param {string} user.user_id - User's unique ID (ULID format)
 * @param {string} user.username - User's username
 * @param {string} user.email - User's email address
 * @param {string} user.display_name - User's display name
 * @param {string} user.avatar_url - Optional avatar URL
 * @param {string} user.bio - Optional user bio
 * @param {string} nonce - The nonce from Discourse's SSO request
 * @param {string} secret - The shared SSO secret configured in Discourse
 * @returns {Object} - Object containing sso payload and sig for redirect
 */
export function generateDiscoursePayload(user, nonce, secret) {
  // Build the SSO payload with user information
  const payload = new URLSearchParams({
    nonce: nonce,
    external_id: user.user_id, // Commonry's ULID user ID
    email: user.email,
    username: user.username,
    name: user.display_name || user.username,
    // Optional fields
    ...(user.avatar_url && { avatar_url: user.avatar_url }),
    ...(user.bio && { bio: user.bio }),
    // Require email activation (users are already verified in Commonry)
    require_activation: "false",
    // Suppress welcome email since they already have a Commonry account
    suppress_welcome_message: "true",
  });

  // Convert to string and encode as base64
  const base64Payload = Buffer.from(payload.toString()).toString("base64");

  // Generate HMAC signature
  const signature = crypto
    .createHmac("sha256", secret)
    .update(base64Payload)
    .digest("hex");

  return {
    sso: base64Payload,
    sig: signature,
  };
}

/**
 * Builds the complete redirect URL back to Discourse with SSO data
 *
 * @param {string} returnUrl - The return_sso_url from Discourse's request
 * @param {string} ssoPayload - The base64-encoded SSO response payload
 * @param {string} signature - The HMAC signature of the payload
 * @returns {string} - Complete URL to redirect user back to Discourse
 */
export function buildDiscourseRedirectUrl(returnUrl, ssoPayload, signature) {
  const url = new URL(returnUrl);
  url.searchParams.set("sso", ssoPayload);
  url.searchParams.set("sig", signature);
  return url.toString();
}

/**
 * Complete SSO flow handler - validates request and generates response
 *
 * @param {string} ssoPayload - The incoming SSO payload from Discourse
 * @param {string} signature - The incoming signature to validate
 * @param {Object} user - The authenticated Commonry user
 * @param {string} secret - The shared SSO secret
 * @returns {Object|null} - Redirect URL and SSO data, or null if validation fails
 */
export function handleDiscourseSSORequest(ssoPayload, signature, user, secret) {
  // Validate the incoming signature
  if (!validateDiscourseSignature(ssoPayload, signature, secret)) {
    return null;
  }

  // Parse the payload
  const { nonce, return_sso_url } = parseDiscoursePayload(ssoPayload);

  if (!nonce || !return_sso_url) {
    return null;
  }

  // Generate response payload with user data
  const response = generateDiscoursePayload(user, nonce, secret);

  // Build redirect URL
  const redirectUrl = buildDiscourseRedirectUrl(
    return_sso_url,
    response.sso,
    response.sig,
  );

  return {
    redirectUrl,
    sso: response.sso,
    sig: response.sig,
  };
}
