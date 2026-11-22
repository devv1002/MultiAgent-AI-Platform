import axios from "axios";
import { deductCreditsDirect } from "../../auth/controllers/auth.controller.js";

export const deductCredits = async (userId, agent) => {
    try {
        if (typeof deductCreditsDirect === "function") {
            return await deductCreditsDirect(userId, agent);
        }
        if (process.env.AUTH_SERVICE) {
            const { data } = await axios.post(`${process.env.AUTH_SERVICE}/deduct-credits`, { userId, agent });
            return data;
        }
        return null;
    } catch (error) {
        console.error("deductCredits error:", error.message);
        return null;
    }
};
