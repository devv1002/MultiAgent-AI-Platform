import axios from "axios";

/**
 * Shared Axios API Client
 *
 * - In local development: If VITE_SERVER_URL is unset, baseURL is empty ("") and
 *   requests (/api/...) are proxied to http://localhost:8000 via Vite's dev proxy.
 * - In production on Vercel: VITE_SERVER_URL must be configured in Vercel Project Settings
 *   with the actual deployed Render backend URL (e.g. https://<render-service>.onrender.com).
 * - withCredentials: true ensures cross-origin session cookies and credentials are sent.
 */
const api = axios.create({
    baseURL: import.meta.env.VITE_SERVER_URL || "",
    withCredentials: true
});

export default api;
