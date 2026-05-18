export default function Spinner({ fullScreen = false }) {
  const spinner = (
    <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
  );
  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        {spinner}
      </div>
    );
  }
  return (
    <div className="flex justify-center py-12">
      {spinner}
    </div>
  );
}
