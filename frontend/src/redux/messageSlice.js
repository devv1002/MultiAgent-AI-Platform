import { createSlice } from "@reduxjs/toolkit";

const messageSlice=createSlice({
    name:"message",
    initialState:{
      messages:[],
      artifacts:[],
      isLoading:false
    },
    reducers:{
       setMessages:(state,action)=>{
        state.messages=action.payload
       },
       addMessage:(state,action)=>{
        state.messages.push(action.payload)
       },
       clearMessages: (state) => {
        state.messages = [],
        state.artifacts = [],
        state.isPreviewOpen = false
       },
      setArtifacts:(state,action)=>{
        state.artifacts=action.payload
       },
      setIsLoading:(state,action)=>{
        state.isLoading=action.payload
       }
    }
   
})

export const {setMessages, addMessage, clearMessages, setArtifacts, setIsLoading}=messageSlice.actions 
export default messageSlice.reducer

