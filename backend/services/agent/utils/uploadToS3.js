import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, BUCKET_NAME } from "../config/s3.js";

export const uploadToS3 = async (filename, buffer, contentType) => {
    await s3.send(
        new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Body: buffer,
            Key: filename,
            ContentType: contentType
        })
    );
    return filename;
};
