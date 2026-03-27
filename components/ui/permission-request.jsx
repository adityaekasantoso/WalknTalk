import { useState } from "react";
import { Mic, RefreshCw, AlertTriangle, Settings } from "lucide-react";

const PermissionRequest = ({ error, permissions, onRetry, className = "" }) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    await onRetry?.();
    setTimeout(() => setIsRetrying(false), 2000);
  };

  const getErrorMessage = (error) => {
    if (!error) return null;

    if (
      error.includes("Permission denied") ||
      error.includes("NotAllowedError")
    ) {
      return {
        title: "Microphone Access Required",
        message:
          "Allow access to your microphone to join the voice room.",
        type: "permission",
      };
    }

    if (
      error.includes("NotFoundError") ||
      error.includes("DevicesNotFoundError")
    ) {
      return {
        title: "No Microphone Found",
        message: "Please check that your microphone is connected and try again.",
        type: "device",
      };
    }

    return {
      title: "Microphone Access Error",
      message: error,
      type: "general",
    };
  };

  const errorInfo = getErrorMessage(error);

  // jika tidak ada error dan mic sudah diizinkan
  if (!error && permissions.audio) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 bg-gradient-to-br from-slate-900/95 via-purple-900/95 to-slate-900/95 backdrop-blur-sm flex items-center justify-center z-50 ${className}`}
    >
      {/* background animation */}
      <div className="absolute inset-0">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-red-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-4000"></div>
      </div>

      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-md mx-4 text-center shadow-2xl relative z-10">
        {/* icon */}
        <div className="w-20 h-20 bg-gradient-to-r from-red-500/30 to-pink-500/30 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-red-400/20 shadow-lg">
          {errorInfo?.type === "device" ? (
            <AlertTriangle size={32} className="text-yellow-300" />
          ) : (
            <Mic size={32} className="text-red-300" />
          )}
        </div>

        {/* title */}
        <h2 className="text-white text-xl font-semibold mb-3">
          {errorInfo?.title || "Microphone Access Required"}
        </h2>

        {/* message */}
        <p className="text-gray-200 text-sm leading-relaxed mb-6">
          {errorInfo?.message ||
            "Allow access to your microphone to join the voice room."}
        </p>

        {/* permission status (MIC ONLY) */}
        <div className="flex justify-center mb-6">
          <div
            className={`flex items-center space-x-2 px-3 py-2 rounded-xl backdrop-blur-sm border shadow-lg ${
              permissions.audio
                ? "bg-green-500/20 border-green-400/30 text-green-300"
                : "bg-red-500/20 border-red-400/30 text-red-300"
            }`}
          >
            <Mic size={16} />
            <span className="text-xs font-medium">
              {permissions.audio ? "Allowed" : "Denied"}
            </span>
          </div>
        </div>

        {/* button */}
        <div className="space-y-3">
          {errorInfo?.type === "permission" && (
            <button
              onClick={() => {
                alert(
                  "Please click the microphone icon in your browser address bar and choose Allow."
                );
              }}
              className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-white/10 text-gray-200 border border-white/20 rounded-2xl hover:bg-white/20 hover:border-white/30 transition-all duration-200 backdrop-blur-sm shadow-lg"
            >
              <Settings size={18} />
              <span>Browser Settings</span>
            </button>
          )}
        </div>

        {/* help text */}
        <div className="mt-6 pt-4 border-t border-white/20">
          <p className="text-gray-300 text-xs">
            {errorInfo?.type === "permission" ? (
              <>💡 Click the microphone icon in the address bar and select Allow</>
            ) : errorInfo?.type === "device" ? (
              <>🔌 Make sure your microphone is properly connected</>
            ) : (
              <>❓ If the issue still occurs, try refreshing the page</>
            )}
          </p>
        </div>      
      </div>
    </div>
  );
};

export default PermissionRequest;