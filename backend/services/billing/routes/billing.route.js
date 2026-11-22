import express from "express";
import crypto from "crypto";
import protect from "../../../gateway/middleware/auth.middleware.js";
import { createOrder, verifyPayment, recoverSettlementsHandler } from "../controllers/billing.controller.js";

const router = express.Router();

/**
 * Middleware: requireInternalServiceKey
 * Protects internal/admin routes from unauthorized access.
 * - Requires 'x-internal-service-key' header.
 * - Compares with process.env.INTERNAL_SERVICE_KEY using constant-time comparison (crypto.timingSafeEqual).
 * - Handles missing, empty, or mismatched keys safely without exceptions.
 * - Rejects unauthorized requests with HTTP 403 Forbidden.
 */
export const requireInternalServiceKey = (req, res, next) => {
    const internalKey = process.env.INTERNAL_SERVICE_KEY;
    const providedKey = req.headers["x-internal-service-key"];

    // 1. Guard against missing or unconfigured environment key
    if (!internalKey || typeof internalKey !== "string" || internalKey.trim() === "") {
        console.error("[Internal Auth] INTERNAL_SERVICE_KEY is not configured on this server");
        return res.status(403).json({ message: "Forbidden: Internal service endpoint is not configured" });
    }

    // 2. Guard against missing or non-string request header
    if (!providedKey || typeof providedKey !== "string") {
        return res.status(403).json({ message: "Forbidden: Missing or invalid x-internal-service-key header" });
    }

    try {
        const expectedBuf = Buffer.from(internalKey, "utf8");
        const providedBuf = Buffer.from(providedKey, "utf8");

        // 3. Constant-time comparison to prevent timing side-channel attacks
        const isMatch = expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf);

        if (!isMatch) {
            return res.status(403).json({ message: "Forbidden: Invalid internal service key" });
        }

        return next();
    } catch (err) {
        return res.status(403).json({ message: "Forbidden: Authentication error" });
    }
};

// User-facing routes require valid user session authentication
router.post("/create", protect, createOrder);
router.post("/verify", protect, verifyPayment);

// Internal/admin recovery route requires trusted internal service key (no user session required)
router.post("/recover-settlements", requireInternalServiceKey, recoverSettlementsHandler);

export default router;
