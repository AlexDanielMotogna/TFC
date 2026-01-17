'use client';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-loss mb-4">500</h1>
        <p className="text-xl text-gray-400 mb-8">Something went wrong</p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/80"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
