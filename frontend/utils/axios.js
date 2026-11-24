import axios from "axios";

/**
 * Shared Axios API Client
 *
 * - In local development: When VITE_SERVER_URL is empty ("") (configured via .env.local),
 *   baseURL is empty and requests (/api/...) are proxied to the deployed Render backend
 *   (https://cortexai-backend-ckao.onrender.com) via Vite's dev proxy on localhost:5173.
 * - In production on Vercel: VITE_SERVER_URL can be set to the deployed Render backend URL,
 *   or left empty to use Vercel's edge rewrites in vercel.json.
 * - withCredentials: true ensures session cookies and credentials are sent with every request.
 */
const api = axios.create({
    baseURL: import.meta.env.VITE_SERVER_URL || "",
    withCredentials: true
});

export default api;
