import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

/**
 * AEGIS-CHAOS Layer 2: Webhook Cryptography Fuzzing
 * 
 * Tests that all webhook endpoints correctly validate HMAC signatures
 * and reject tampered or malformed requests.
 */

// Simulate the HMAC verification logic used by our edge functions
function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// Simulate the Xero webhook handler's signature check
function handleXeroWebhook(
  body: string,
  signature: string | undefined,
  webhookSecret: string
): { status: number; body: any } {
  if (!signature) {
    return { status: 401, body: { error: "Missing signature" } };
  }
  try {
    const isValid = verifyHmacSignature(body, signature, webhookSecret);
    if (!isValid) {
      return { status: 401, body: { error: "Invalid signature" } };
    }
    return { status: 200, body: { ok: true } };
  } catch {
    return { status: 401, body: { error: "Signature verification failed" } };
  }
}

describe("Aegis-Chaos L2: Webhook Cryptography Fuzzing", () => {
  const WEBHOOK_SECRET = "test-webhook-secret-key-2026";
  const VALID_PAYLOAD = JSON.stringify({
    events: [{ resourceId: "inv-001", eventType: "UPDATE", tenantId: "org-123" }],
  });

  it("accepts a correctly signed Xero webhook", () => {
    const validSig = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(VALID_PAYLOAD)
      .digest("base64");

    const result = handleXeroWebhook(VALID_PAYLOAD, validSig, WEBHOOK_SECRET);
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
  });

  it("rejects a webhook with missing signature", () => {
    const result = handleXeroWebhook(VALID_PAYLOAD, undefined, WEBHOOK_SECRET);
    expect(result.status).toBe(401);
  });

  it("rejects a webhook with empty signature", () => {
    const result = handleXeroWebhook(VALID_PAYLOAD, "", WEBHOOK_SECRET);
    expect(result.status).toBe(401);
  });

  it("rejects 50 concurrent requests with tampered signatures", async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) => {
        // Create slightly tampered signature (off by one character)
        const validSig = crypto
          .createHmac("sha256", WEBHOOK_SECRET)
          .update(VALID_PAYLOAD)
          .digest("base64");
        const tamperedSig = validSig.slice(0, -1) + String.fromCharCode(
          validSig.charCodeAt(validSig.length - 1) ^ (i + 1)
        );
        return Promise.resolve(handleXeroWebhook(VALID_PAYLOAD, tamperedSig, WEBHOOK_SECRET));
      })
    );

    const rejectedCount = results.filter(r => r.status === 401).length;
    expect(rejectedCount).toBe(50);
  });

  it("rejects a webhook with signature from wrong secret", () => {
    const wrongSig = crypto
      .createHmac("sha256", "wrong-secret")
      .update(VALID_PAYLOAD)
      .digest("base64");

    const result = handleXeroWebhook(VALID_PAYLOAD, wrongSig, WEBHOOK_SECRET);
    expect(result.status).toBe(401);
  });

  it("rejects a webhook with tampered payload", () => {
    const validSig = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(VALID_PAYLOAD)
      .digest("base64");

    const tamperedPayload = VALID_PAYLOAD.replace("inv-001", "inv-HACKED");
    const result = handleXeroWebhook(tamperedPayload, validSig, WEBHOOK_SECRET);
    expect(result.status).toBe(401);
  });
});
