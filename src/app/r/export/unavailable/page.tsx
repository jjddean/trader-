export default function ReviewUnavailablePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm font-semibold text-slate-900">This review is not available</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          The link has already been used, has expired, or the review was withdrawn. Open the
          case again from your consultant inbox to get a new one.
        </p>
      </div>
    </div>
  );
}
