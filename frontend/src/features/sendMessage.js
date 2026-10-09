
import api from '../../utils/axios';

async function sendMessage(payload) {
  try {
    const { data } = await api.post("/api/agent/chat", payload);
    return data;
  } catch (error) {
    console.error("Chat API error:", error.response?.data || error.message);
    throw error;
  }
}

export default sendMessage;
