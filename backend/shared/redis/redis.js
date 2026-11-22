import Redis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
const redisUrl = (process.env.REDIS_URL || "").trim();

// In production, REDIS_URL is mandatory (supports Upstash rediss:// TLS endpoints)
if (isProduction && !redisUrl) {
    throw new Error(
        "Production Configuration Error: REDIS_URL environment variable is required in production. " +
        "Silent fallback to localhost is disabled."
    );
}

// Fallback to localhost is permitted in local development only
const activeRedisUrl = redisUrl || "redis://localhost:6379";

const redis = new Redis(activeRedisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 5000,
    commandTimeout: 3000,
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
});

redis.on("connect", () => {
    console.log("Redis connected successfully");
});

redis.on("error", (error) => {
    console.error("Redis connection warning:", error.message);
});

export default redis;