export default function Spinner({ fullScreen = false }) {
  const spinner = (
    <div role="status" aria-label="Loading" className="h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-brand" />
  );
  if (fullScreen) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        {spinner}
      </div>
    );
  }
  return (
    <div className="flex justify-center py-[72px]">
      {spinner}
    </div>
  );
}
