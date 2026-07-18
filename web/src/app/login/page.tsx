"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Github, Chrome, Lock, Mail, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient font-bold text-white">N</div>
          <div>
            <div className="font-bold gradient-text">NeuroSync</div>
            <div className="text-xs text-slate-500">Control Room Access</div>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); router.push("/dashboard"); }} className="flex flex-col gap-4">
          <label className="text-sm">
            <span className="text-slate-400">Email</span>
            <div className="relative mt-1">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input type="email" required defaultValue="operator@neurosync.io"
                className="w-full rounded-xl border border-border bg-white/5 py-2.5 pl-10 pr-3 outline-none focus:border-brand-cyan/50" />
            </div>
          </label>
          <label className="text-sm">
            <span className="text-slate-400">Password</span>
            <div className="relative mt-1">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input type="password" required defaultValue="••••••••"
                className="w-full rounded-xl border border-border bg-white/5 py-2.5 pl-10 pr-3 outline-none focus:border-brand-cyan/50" />
            </div>
          </label>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Remember me</label>
            <a className="hover:text-brand-cyan" href="#">Forgot password?</a>
          </div>
          <button className="btn-primary w-full justify-center">Sign in <ArrowRight className="h-4 w-4" /></button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.push("/dashboard")} className="btn-ghost flex-1 justify-center"><Chrome className="h-4 w-4" /> Google</button>
          <button onClick={() => router.push("/dashboard")} className="btn-ghost flex-1 justify-center"><Github className="h-4 w-4" /> GitHub</button>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          <Link href="/" className="hover:text-brand-cyan">← Back to home</Link>
        </p>
      </motion.div>
    </div>
  );
}
