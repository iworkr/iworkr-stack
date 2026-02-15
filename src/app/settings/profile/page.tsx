"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { SaveToast, useSaveToast } from "@/components/settings/save-toast";

export default function ProfilePage() {
  const { visible, showSaved } = useSaveToast();
  const [name, setName] = useState("Mike Thompson");
  const [username, setUsername] = useState("mike");
  const [email] = useState("mike@apexplumbing.com.au");

  return (
    <>
      <h1 className="mb-8 text-2xl font-medium tracking-tight text-zinc-100">
        Profile
      </h1>

      {/* Avatar */}
      <div className="mb-8 flex items-center gap-5">
        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800 text-lg font-medium text-zinc-300">
            MT
          </div>
          <button className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(255,255,255,0.15)] bg-[#141414] text-zinc-400 transition-colors hover:text-zinc-200">
            <Camera size={11} />
          </button>
        </div>
        <div>
          <div className="text-[14px] font-medium text-zinc-200">Mike Thompson</div>
          <div className="text-[12px] text-zinc-600">Admin · Apex Plumbing</div>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-zinc-500">
            Full name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={showSaved}
            className="w-full max-w-sm rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[13px] text-zinc-200 outline-none transition-colors focus:border-[rgba(255,255,255,0.25)]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-zinc-500">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={showSaved}
            className="w-full max-w-sm rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[13px] text-zinc-200 outline-none transition-colors focus:border-[rgba(255,255,255,0.25)]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-zinc-500">
            Email
          </label>
          <div className="flex max-w-sm items-center rounded-md border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[13px] text-zinc-500">
            {email}
          </div>
          <p className="mt-1 text-[11px] text-zinc-600">
            Contact an admin to change your email address.
          </p>
        </div>
      </div>

      <SaveToast visible={visible} />
    </>
  );
}
