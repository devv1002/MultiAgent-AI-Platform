import { supabase, BUCKET_NAME, validateStorageKey } from "../config/s3.js";

export { validateStorageKey };

/**
 * Upload an artifact buffer to private Supabase Storage.
 * Overwrites are strictly prohibited (upsert: false) to prevent cross-user collisions.
 * All keys must pass strict object path validation.
 *
 * @param {string} filename - Target object name/key in bucket
 * @param {Buffer|Uint8Array} buffer - File binary content
 * @param {string} contentType - MIME type (e.g., 'application/pdf', 'image/png')
 * @returns {Promise<string>} The uploaded object key
 */
export const uploadToS3 = async (filename, buffer, contentType) => {
    // 1. Strict object path validation
    const cleanFilename = validateStorageKey(filename);

    if (!buffer || (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array))) {
        throw new Error("Storage Upload Error: Missing or invalid file buffer");
    }

    if (!supabase) {
        throw new Error(
            "Supabase Storage client is not initialized. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
        );
    }

    // 2. Upload to private Supabase Storage bucket with content-type
    // upsert: false strictly prevents overwriting existing objects
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(cleanFilename, buffer, {
            contentType: contentType || "application/octet-stream",
            upsert: false
        });

    if (error) {
        console.error(`[Supabase Upload Error] Failed uploading ${cleanFilename}:`, error.message);
        if (
            error.statusCode === "409" ||
            error.statusCode === 409 ||
            error.message?.toLowerCase().includes("already exists") ||
            error.message?.toLowerCase().includes("duplicate")
        ) {
            throw new Error(`Storage Upload Error: Object '${cleanFilename}' already exists. Overwrites are prohibited.`);
        }
        throw new Error(`Failed to upload artifact to storage: ${error.message}`);
    }

    return cleanFilename;
};
