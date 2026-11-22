import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

let isConnected = false;

/**
 * Connect to the MongoDB Atlas cluster.
 * Reuses the existing connection if already established.
 */
export const connectDB = async (uri = process.env.MONGODB_URI) => {
    if (isConnected || mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    if (!uri) {
        throw new Error("MONGODB_URI environment variable is missing");
    }

    try {
        await mongoose.connect(uri);
        isConnected = true;
        console.log("MongoDB connected to cluster successfully");
        return mongoose.connection;
    } catch (error) {
        console.error("MongoDB connection error:", error.message);
        throw error;
    }
};

/**
 * Creates a model bound to a specific database name on the shared MongoDB Atlas connection.
 * Preserves existing multi-database architecture (auth, chat, billing, agent) without data loss.
 */
export const createMultiDbModel = (dbName, modelName, schema) => {
    const getModel = () => {
        const db = mongoose.connection.readyState !== 0
            ? mongoose.connection.useDb(dbName, { useCache: true })
            : mongoose;
        return db.models[modelName] || db.model(modelName, schema);
    };

    return new Proxy(function () {}, {
        get(target, prop) {
            const model = getModel();
            const val = model[prop];
            return typeof val === "function" ? val.bind(model) : val;
        },
        apply(target, thisArg, argumentsList) {
            const model = getModel();
            return new model(...argumentsList);
        },
        construct(target, argumentsList) {
            const model = getModel();
            return new model(...argumentsList);
        }
    });
};

export default connectDB;
