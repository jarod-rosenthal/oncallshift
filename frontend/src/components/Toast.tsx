import { Toaster, toast } from 'sonner';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

// Preset messages matching mobile app patterns
export const toastMessages = {
  acknowledge: "Got it. You're on it.",
  resolve: "Incident resolved. Nice work!",
  escalate: "Escalated. Help is on the way.",
  note_added: "Note added.",
  copied: "Copied to clipboard.",
  offline_action: "Saved. Will sync when online.",
  error: "Something went wrong. Try again.",
  saved: "Changes saved.",
  deleted: "Successfully deleted.",
  created: "Successfully created.",
};

// Toast provider component - add to App.tsx
export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 3000,
        className: 'font-sans',
        style: {
          padding: '12px 16px',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: 500,
        },
      }}
      icons={{
        success: <CheckCircle className="h-5 w-5 text-green-500" />,
        error: <XCircle className="h-5 w-5 text-red-500" />,
        warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
        info: <Info className="h-5 w-5 text-blue-500" />,
      }}
    />
  );
}

// Toast helper functions
export const showToast = {
  success: (message: string) => {
    toast.success(message);
  },
  error: (message: string) => {
    toast.error(message);
  },
  warning: (message: string) => {
    toast.warning(message);
  },
  info: (message: string) => {
    toast.info(message);
  },
  // Preset messages
  acknowledge: () => toast.success(toastMessages.acknowledge),
  resolve: () => toast.success(toastMessages.resolve),
  escalate: () => toast.success(toastMessages.escalate),
  noteAdded: () => toast.success(toastMessages.note_added),
  copied: () => toast.success(toastMessages.copied),
  saved: () => toast.success(toastMessages.saved),
  deleted: () => toast.success(toastMessages.deleted),
  created: () => toast.success(toastMessages.created),
  genericError: () => toast.error(toastMessages.error),
  // Promise-based toast for async operations
  promise: <T,>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string }
  ) => {
    return toast.promise(promise, messages);
  },
};

// Re-export toast for direct usage
export { toast };
