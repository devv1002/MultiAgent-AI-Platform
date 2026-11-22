import axios from "axios";

// When deployed on Vercel with rewrites, baseURL is empty to allow relative requests (/api/...)
// For local development, VITE_SERVER_URL can be set to http://localhost:8000
const api = axios.create({
    baseURL: import.meta.env.VITE_SERVER_URL || "",
    withCredentials: true
});

export default api;
