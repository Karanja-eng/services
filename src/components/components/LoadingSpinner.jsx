// Loading Spinner Component with Rotating Gear Icon
import React from 'react';
import { Settings } from 'lucide-react';

export const LoadingSpinner = ({ size = 'md', message = 'Loading...' }) => {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
        xl: 'w-16 h-16'
    };

    return (
        <div className="flex flex-col items-center justify-center gap-3">
            <Settings
                className={`${sizeClasses[size]} text-teal-500 dark:text-teal-400 animate-spin`}
                style={{ animationDuration: '2s' }}
            />
            {message && (
                <p className="text-sm text-slate-600 dark:text-slate-400 animate-pulse">
                    {message}
                </p>
            )}
        </div>
    );
};

export const LoadingOverlay = ({ message = 'Processing...' }) => {
    return (
        <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50">
            <LoadingSpinner size="xl" message={message} />
        </div>
    );
};

export default LoadingSpinner;
