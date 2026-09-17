import React from 'react';
import { Activity } from 'lucide-react';

interface LoadingProps {
  message?: string;
}

export const Loading: React.FC<LoadingProps> = ({ message = 'AI is processing voice consultation...' }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white/40 border border-brand-teal/10 rounded-xl shadow-inner backdrop-blur-sm">
      <div className="relative flex items-center justify-center mb-4">
        {/* Radar waves */}
        <span className="absolute inline-flex h-12 w-12 rounded-full bg-brand-teal/20 animate-ping-slow"></span>
        <div className="relative bg-brand-teal/10 p-3 rounded-full border border-brand-teal/30">
          <Activity className="w-6 h-6 text-brand-teal animate-pulse" />
        </div>
      </div>
      
      <p className="text-sm font-semibold text-brand-forest tracking-wide animate-pulse">{message}</p>
      
      {/* Mock audio wave bar animation */}
      <div className="flex gap-1.5 items-center justify-center mt-3 h-6">
        <div className="w-1 bg-brand-teal rounded-full animate-pulse h-3" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-1 bg-brand-teal rounded-full animate-pulse h-5" style={{ animationDelay: '0.3s' }}></div>
        <div className="w-1 bg-brand-teal rounded-full animate-pulse h-2" style={{ animationDelay: '0.5s' }}></div>
        <div className="w-1 bg-brand-teal rounded-full animate-pulse h-4" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-1 bg-brand-teal rounded-full animate-pulse h-1" style={{ animationDelay: '0.4s' }}></div>
      </div>
    </div>
  );
};

export default Loading;
