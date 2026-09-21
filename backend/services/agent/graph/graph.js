import { StateGraph } from "@langchain/langgraph";
import { agentState } from "./state.js";

const workflow=new StateGraph(agentState)
