import { signInWithPopup } from 'firebase/auth'
import React from 'react'
import { auth, googleProvider } from '../../utils/firebase'
import api from '../../utils/axios'
import { FcGoogle } from "react-icons/fc";


function Home() {
    const handleLogin = async (token) => {
        try {
          const {data} = await api.post("/auth/login", {token})
          console.log(data)
        } catch (error) {
          console.log(error)
        }
      }
    
      const googleLogin = async () => {
        try {
          const data = await signInWithPopup(auth, googleProvider)
      
          const token = await data.user.getIdToken()
      
          console.log("Firebase token:", token)
      
          await handleLogin(token)
      
          console.log("Google login successful:", data)
        } catch (error) {
          console.error("Google login failed:", error.code, error.message)
        }
      }
  return (
    <div className="h-screen flex bg-[#0d0f14] text-white overflow-hidden">
        <h1>Hello World</h1>
      <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'>

        <div className='w-[340px] bg-[#13151c] border border-white/[0.08] rounded-2xl p-7 flex flex-col gap-5'>
            <div className='flex flex-col gap-1'>
                <h2 className='text-[17px] font-semibold text-slate-100 tracking-tight'>Welcome to CortexAI</h2>
                <p className='text-[13px] text-slate-500'>Please login to continue using the app.</p>
            </div>
            <button className='w-full flex items-center justify-center'>
                <FcGoogle size={15} className='text-white'/>
                Continue with Google
            </button>
        </div>

      </div>
    </div>
  )
}

export default Home
