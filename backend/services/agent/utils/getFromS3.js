import { supabase, BUCKET_NAME, DEFAULT_PRESIGNED_EXPIRY, validateStorageKey } from "../config/s3.js";

export { validateStorageKey };

/**
 * Generate a secure, time-limited presigned download URL for private documents.
 * All generated user documents (PDFs, PPTs, artifacts) remain private in the bucket
 * and are accessible ONLY through short-lived presigned URLs.
 * All keys must pass strict object path validation.
 *
 * @param {string} filename - Object key in Supabase Storage bucket
 * @param {number} expiresIn - Expiration in seconds (default: 15 minutes / 900s)
 * @returns {Promise<string>} Signed download URL
 */
export const getFromS3 = async (filename, expiresIn = DEFAULT_PRESIGNED_EXPIRY) => {
    // 1. Strict object path validation
    const cleanFilename = validateStorageKey(filename);

    if (!supabase) {
        throw new Error(
            "Supabase Storage client is not initialized. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
        );
    }

    // Ensure expiresIn is a positive integer
    const validExpiry = (typeof expiresIn === "number" && expiresIn > 0)
        ? Math.floor(expiresIn)
        : DEFAULT_PRESIGNED_EXPIRY;

    // 2. Generate time-limited signed URL via Supabase Storage
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(cleanFilename, validExpiry);

    if (error || !data?.signedUrl) {
        console.error(`[Supabase SignedUrl Error] Failed signing URL for ${cleanFilename}:`, error?.message || "No URL returned");
        throw new Error(`Failed to generate signed download URL: ${error?.message || "Object not found"}`);
    }

    return data.signedUrl;
};
