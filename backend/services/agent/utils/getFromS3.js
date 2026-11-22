import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, BUCKET_NAME, DEFAULT_PRESIGNED_EXPIRY, R2_PUBLIC_URL } from "../config/s3.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";

/**
 * Generate a secure, time-limited presigned download URL for private documents.
 * All generated user documents (PDFs, PPTs, artifacts) remain private in the bucket
 * and are accessible ONLY through short-lived presigned URLs.
 *
 * @param {string} filename - Object key in S3 / R2
 * @param {number} expiresIn - Expiration in seconds (default: 15 minutes / 900s)
 * @returns {Promise<string>} Signed download URL
 */
export const getFromS3 = async (filename, expiresIn = DEFAULT_PRESIGNED_EXPIRY) => {
    return await getSignedUrl(
        s3,
        new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: filename
        }),
        { expiresIn }
    );
};

/**
 * Controlled helper for explicitly public images ONLY.
 * User documents (PDFs, PPTs) must NEVER use this function.
 *
 * @param {string} filename - Object key in S3 / R2
 * @returns {string} Public CDN URL
 */
export const getPublicImageUrl = (filename) => {
    if (!R2_PUBLIC_URL) {
        throw new Error("R2_PUBLIC_URL is not configured for public image access");
    }
    const cleanBase = R2_PUBLIC_URL.replace(/\/+$/, "");
    return `${cleanBase}/${filename}`;
};
