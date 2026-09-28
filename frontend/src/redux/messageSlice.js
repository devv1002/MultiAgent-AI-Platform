import { createSlice } from "@reduxjs/toolkit";

const messageSlice=createSlice({
    name:"message",
    initialState:{
      messages:[],
      artifacts:[]
    },
    reducers:{
       setMessages:(state,action)=>{
        state.messages=action.payload
       },
       addMessage:(state,action)=>{
        state.messages.push(action.payload)
       },
       clearMessages: (state) => {
        state.messages = []
       },
      setArtifacts:(state,action)=>{
        state.artifacts=action.payload
       }
    }
   
})

export const {setMessages, addMessage, clearMessages, setArtifacts}=messageSlice.actions 
export default messageSlice.reducer

