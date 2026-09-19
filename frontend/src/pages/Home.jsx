import { signInWithPopup } from 'firebase/auth'
import React from 'react'
import { auth, googleProvider } from '../../utils/firebase'
import api from '../../utils/axios'
import { FcGoogle } from "react-icons/fc";
import { useDispatch, useSelector } from 'react-redux';
import { setUserdata } from '../redux/userSlice';


function Home() {
    const dispatch = useDispatch();

    const {userData} = useSelector(state=>state.user)
    console.log(userData)

    const handleLogin = async (token) => {
      console.log("1. handleLogin called");

      try {
          console.log("2. Sending request to backend.");

          const { data } = await api.post("/api/auth/login", { token });

          console.log("3. Backend response:", data);

          dispatch(setUserdata(data));
      } catch (error) {
          console.log("4. Backend login error:", error);
      }
  };

  const googleLogin = async () => {
      try {
          console.log("A. Google login started");

          const data = await signInWithPopup(auth, googleProvider);

          console.log("B. Firebase popup successful");

          const token = await data.user.getIdToken();

          console.log("C. Firebase token received");

          await handleLogin(token);

          console.log("D. Google login successful:", data);
      } catch (error) {
          console.error(
              "Google login failed:",
              error.code,
              error.message
          );
      }
  };
  return (
    <div className="h-screen flex bg-[#0d0f14] text-white overflow-hidden">

        {!userData && <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'>

            <div className='w-85 bg-[#13151c] border border-white/8 rounded-2xl p-7 flex flex-col gap-5'>
                <div className='flex flex-col gap-1'>
                    <h2 className='text-[17px] font-semibold text-slate-100 tracking-tight'>Welcome to CortexAI</h2>
                    <p className='text-[13px] text-slate-500'>Please login to continue using the app.</p>
                </div>
                <button className='w-full flex items-center justify-center gap-3 py-2.75 rounded-xl text-sm font-medium text-black/90 bg-white hover:bg-gray-200 transition-all duration-150 cursor-pointer' onClick={googleLogin}>
                    <FcGoogle size={15}/>
                    Continue with Google
                </button>
            </div>

        </div>}
    </div>
  )
}

export default Home
