'use client'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React from 'react'

const NotFound = () => {

    const router = useRouter();
  return (
    <div className='h-screen w-screen bg-[#F3F4F6] text-white flex flex-col items-center justify-center'>


        <h1 className="text-3xl text-[#8B8B8B] font-bold mt-4">Page Not Found</h1>
          
<div className="d flex flex-col items-center justify-center ">
      <video src='/404.mp4' autoPlay loop muted style={{ width: '50%', height: 'auto' }} />
        <p className="text-[#8B8B8B] text-sm font-mono">The page you are looking for does not exist.</p>
        <p onClick={() => router.push("/")} className="text-[#8B8B8B] hover:cursor-pointer flex items-center justify-center px-6 py-3 border border-gray-500 rounded-tl-full rounded-bl-full mt-4 font-semibold text-sm font-mono">  <ArrowLeft className='w-4 mr-2 animate-wiggleX font-bold' /> Go Back</p>

    </div>   
     </div>
  )
}

export default NotFound
