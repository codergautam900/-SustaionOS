import React from "react";
import { useNavigate } from "react-router-dom";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-10 text-white">
      <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">404</div>
        <h1 className="mt-4 text-4xl font-bold">This page is not part of your SustainOS workspace.</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          The route may have changed, or the link may be stale. Use one of the safe entry points below.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-black"
          >
            Open dashboard
          </button>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white"
          >
            Go to login
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
