import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// In production, Supabase Storage credentials are strictly required
if (isProduction && (!supabaseUrl || !supabaseKey)) {
    throw new Error(
        "Production Configuration Error: Supabase Storage credentials are required in production " +
        "(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET_NAME). " +
        "Silent fallback to AWS S3 / Cloudflare R2 is disabled."
    );
}

// Initialize Supabase client with service_role key to manage private bucket
export const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    })
    : null;

export const BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || "cortexai-files";
export const STORAGE_PROVIDER = "supabase";
export const DEFAULT_PRESIGNED_EXPIRY = 15 * 60; // 15 minutes (900 seconds)

/**
 * Validate that a storage key is a secure, flat object name.
 * Prevents path traversal, injection, directory escapes, and malformed names.
 *
 * @param {string} key - Object key / filename to validate
 * @returns {string} Validated filename
 * @throws {Error} If key is invalid, unsafe, or violates naming constraints
 */
export const validateStorageKey = (key) => {
    // 1. Check for null, undefined, or non-string
    if (key === null || key === undefined || typeof key !== "string") {
        throw new Error("Storage Key Error: Key must be a non-empty string");
    }

    const trimmed = key.trim();

    // 2. Reject empty or whitespace-only keys
    if (trimmed.length === 0) {
        throw new Error("Storage Key Error: Key cannot be empty or whitespace-only");
    }

    // 3. Reject '.' and '..'
    if (trimmed === "." || trimmed === "..") {
        throw new Error("Storage Key Error: Relative path references ('.' or '..') are forbidden");
    }

    // 4. Reject null bytes (\0, %00)
    if (trimmed.includes("\0") || /%00/i.test(trimmed)) {
        throw new Error("Storage Key Error: Null bytes are forbidden in storage keys");
    }

    // 5. Reject forward slashes, backslashes, and path separators
    if (trimmed.includes("/") || trimmed.includes("\\")) {
        throw new Error("Storage Key Error: Forward slashes, backslashes, and path separators are forbidden. Keys must be flat object names.");
    }

    // 6. Reject path traversal and URL-encoded traversal/separators (../, ..\, %2e%2e, %2f, %5c)
    if (
        trimmed.includes("..") ||
        /%2e%2e/i.test(trimmed) ||
        /%2f/i.test(trimmed) ||
        /%5c/i.test(trimmed)
    ) {
        throw new Error("Storage Key Error: Path traversal sequences are forbidden");
    }

    // 7. Check URL-decoded key to prevent double-encoding bypasses
    try {
        const decoded = decodeURIComponent(trimmed);
        if (
            decoded.includes("\0") ||
            decoded.includes("/") ||
            decoded.includes("\\") ||
            decoded.includes("..") ||
            decoded === "." ||
            decoded === ".."
        ) {
            throw new Error("Storage Key Error: Encoded path traversal or separator sequences detected");
        }
    } catch (err) {
        if (err.message?.includes("Storage Key Error")) throw err;
        throw new Error("Storage Key Error: Malformed URL-encoded key");
    }

    // 8. Ensure keys are flat object names matching expected document naming convention
    // e.g. pdf-<uuid>.pdf, ppt-<uuid>.pptx, image-<uuid>.png, test.pdf, etc.
    const flatFilenameRegex = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.[a-zA-Z0-9]+$/;
    if (!flatFilenameRegex.test(trimmed)) {
        throw new Error(`Storage Key Error: Key '${trimmed}' does not match expected flat document naming convention (e.g., pdf-<id>.pdf, ppt-<id>.pptx, image-<id>.png)`);
    }

    return trimmed;
};
