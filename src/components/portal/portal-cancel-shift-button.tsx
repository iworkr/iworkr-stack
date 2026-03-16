"use client";

import { useState, useTransition } from "react";
import { requestPortalShiftCancellation } from "@/app/actions/portal-family";

type Props = {
  shiftId: string;
  isShortNotice?: boolean;
};

export function PortalCancelShiftButton({ shiftId, isShortNotice }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isShort = isShortNotice ?? false;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/15"
      >
        Cancel Shift
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-700 bg-[#090909] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-zinc-100">Cancel Shift</h3>
            <p className="mt-1 text-sm text-zinc-400">
              {isShort
                ? "This is a short-notice cancellation (within 7 days)."
                : "This cancellation is outside the 7-day short-notice window."}
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-500"
              placeholder="Reason for cancellation"
            />
            {isShort && (
              <label className="mt-3 flex items-start gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                  className="mt-0.5"
                />
                I understand this may still be claimed as a short-notice NDIS cancellation.
              </label>
            )}
            {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
              >
                Keep Shift
              </button>
              <button
                disabled={pending || !reason.trim() || (isShort && !ack)}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const result = await requestPortalShiftCancellation({
                      schedule_block_id: shiftId,
                      reason,
                      acknowledge_short_notice: ack,
                    });
                    if (!result.success) {
                      setError(result.error || "Cancellation failed.");
                      return;
                    }
                    setOpen(false);
                    window.location.reload();
                  })
                }
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
