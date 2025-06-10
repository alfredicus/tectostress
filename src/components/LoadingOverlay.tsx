// LoadingOverlay.tsx
import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
    isVisible: boolean;
    message: string;
    progress?: number;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
    isVisible,
    message,
    progress
}) => {
    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
                <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                    <h3 className="text-lg font-semibold text-gray-900">{message}</h3>

                    {progress !== undefined && (
                        <div className="w-full">
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div
                                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                            {/* <p className="text-sm text-gray-600 mt-2 text-center">
                                {progress.toFixed(0)}% complete
                            </p> */}
                        </div>
                    )}

                    <p className="text-sm text-gray-500 text-center">
                        Please wait while we process your data...
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoadingOverlay;