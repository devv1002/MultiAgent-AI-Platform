import express from "express";
import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";

// Shared infrastructure
import { connectDB } from "./shared/db/connect.js";
import redis from "./shared/redis/redis.js";

// Middleware & Gateway controllers
import protect from "./gateway/middleware/auth.middleware.js";
import { getCurrentUser } from "./gateway/controllers/user.controller.js";

// Service Routers
import { publicAuthRouter } from "./services/auth/routes/auth.route.js";
import { publicChatRouter } from "./services/chat/routes/chat.routes.js";
import agentRouter from "./services/agent/routes/agent.route.js";
import billingRouter from "./services/billing/routes/billing.route.js";

const app = express();
const port = process.env.PORT || 8000;

// CORS configuration supporting local dev, Vercel production, and Vercel preview deployments
const isAllowedOrigin = (origin) => {
    if (!origin) return true; // Server-to-server or curl requests
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL.replace(/\/+$/, "")) {
        return true;
    }
    if (origin.endsWith(".vercel.app")) {
        return true;
    }
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
        return true;
    }
    return false;
};

app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            callback(null, true);
        } else {
            callback(null, true); // Fallback to permissive to ensure rewrites don't block
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-user-id"]
}));

app.use(morgan("dev"));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoints
app.get("/", (req, res) => {
    res.json({
        service: "CortexAI Backend API",
        status: "healthy",
        environment: process.env.NODE_ENV || "production",
        timestamp: new Date().toISOString()
    });
});

app.get("/health", (req, res) => {
    res.status(200).json({ status: "healthy" });
});

// Mount Public Routes
app.use("/api/auth", publicAuthRouter);

// Mount Protected Routes
app.use("/api/chat", protect, publicChatRouter);
app.use("/api/agent", protect, agentRouter);
app.use("/api/billing", billingRouter);
app.get("/api/me", protect, getCurrentUser);

// Centralized Error Handler
app.use((err, req, res, next) => {
    console.error("Central Error Handler:", err.message || err);

    // Clean up uploaded file if error occurred during request pipeline
    if (req.file?.path) {
        import("./services/agent/config/multer.js").then(({ cleanupTempFile }) => {
            cleanupTempFile(req.file.path);
        }).catch(() => {});
    }

    // Multer file size limit exceeded
    if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
            message: "File upload exceeds the 10 MB limit. Please upload a smaller file."
        });
    }

    if (err.status) {
        return res.status(err.status).json(err.data || { message: err.message });
    }
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
        message: err.message || "Internal Server Error"
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});

// Server Initialization
let server;

const startServer = async () => {
    try {
        await connectDB();
        server = app.listen(port, () => {
            console.log(`CortexAI consolidated backend listening on port ${port}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
};

startServer();

// Graceful Shutdown
const handleShutdown = async (signal) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    if (server) {
        server.close(() => {
            console.log("HTTP server closed.");
        });
    }
    try {
        if (redis && redis.status === "ready") {
            await redis.quit();
            console.log("Redis client disconnected.");
        }
    } catch (e) {
        console.error("Error closing Redis:", e.message);
    }
    process.exit(0);
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

export default app;
