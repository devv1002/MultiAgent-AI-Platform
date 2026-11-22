import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
const explicitProvider = (process.env.STORAGE_PROVIDER || "").toLowerCase();

// Determine and validate storage provider
let activeProvider;

if (explicitProvider === "aws") {
    // Explicit opt-in for legacy AWS S3
    activeProvider = "aws";
    console.log("[Storage] Explicit AWS S3 legacy provider selected.");
} else if (process.env.R2_ACCESS_KEY_ID && (process.env.R2_ACCOUNT_ID || process.env.R2_ENDPOINT)) {
    // Cloudflare R2 is configured
    activeProvider = "r2";
} else if (isProduction) {
    // In production, Cloudflare R2 is required unless explicitly opted into legacy AWS
    throw new Error(
        "Production Configuration Error: Cloudflare R2 storage credentials are required in production " +
        "(R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME). " +
        "Silent fallback to AWS S3 is disabled to prevent accidental AWS billing. " +
        "To explicitly use AWS S3 as a legacy fallback, set STORAGE_PROVIDER=aws."
    );
} else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_KEY) {
    // Non-production fallback only
    activeProvider = "aws";
    console.warn("[Storage Warning] Using AWS S3 fallback in non-production environment.");
} else {
    // Development default when no storage credentials are configured
    activeProvider = "r2";
}

let clientConfig;
let bucketName;

if (activeProvider === "r2") {
    const endpoint = process.env.R2_ENDPOINT || (
        process.env.R2_ACCOUNT_ID
            ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
            : undefined
    );

    clientConfig = {
        region: "auto",
        endpoint: endpoint,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
        },
    };
    bucketName = process.env.R2_BUCKET_NAME;
} else {
    clientConfig = {
        region: process.env.AWS_REGION || "ap-southeast-2",
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
            secretAccessKey: process.env.AWS_SECRET_KEY || "",
        },
    };
    bucketName = process.env.AWS_BUCKET_NAME;
}

export const s3 = new S3Client(clientConfig);
export const BUCKET_NAME = bucketName;
export const STORAGE_PROVIDER = activeProvider;
export const DEFAULT_PRESIGNED_EXPIRY = 15 * 60; // 15 minutes (900 seconds)
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";
