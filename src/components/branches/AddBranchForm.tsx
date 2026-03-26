"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useToastStore } from "@/components/app/action-toast";
import { createBranch } from "@/app/actions/branches";
import { BranchSchema } from "@/lib/validations/branch";

const TIMEZONES = [
  "Australia/Sydney",
  "Australia/Brisbane",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Adelaide",
  "Pacific/Auckland",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Singapore",
];

interface AddBranchFormProps {
  workspaceId: string;
  onCancel: () => void;
  onSuccess?: () => void;
}

type BranchFormInput = z.input<typeof BranchSchema>;
type BranchFormOutput = z.output<typeof BranchSchema>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-[11px] text-rose-400">{message}</p>;
}

export function AddBranchForm({ workspaceId, onCancel, onSuccess }: AddBranchFormProps) {
  const router = useRouter();
  const { addToast } = useToastStore();
  const defaultValues = useMemo<BranchFormInput>(
    () => ({
      name: "",
      city: "",
      timezone: "Australia/Sydney",
      tax_rate: 10,
      address: "",
      state: "",
      postal_code: "",
      phone: "",
      email: "",
    }),
    [],
  );

  const form = useForm<BranchFormInput, unknown, BranchFormOutput>({
    resolver: zodResolver(BranchSchema),
    defaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const {
    register,
    formState: { errors, isSubmitting },
    handleSubmit,
  } = form;

  const onSubmit = async (data: BranchFormOutput) => {
    const res = await createBranch({
      organization_id: workspaceId,
      ...data,
    });

    if (res.error) {
      addToast(res.error || "Failed to create branch. Please try again.", undefined, "error");
      return;
    }

    addToast("Branch created successfully.");
    onSuccess?.();
    router.push("/settings/branches");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-5">
      <div>
        <label className="mb-1 block text-[10px] text-zinc-600">Branch Name *</label>
        <input
          {...register("name")}
          placeholder="Gold Coast Office"
          className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-[12px] text-zinc-300 outline-none focus:border-[#10B981]/30"
        />
        <FieldError message={errors.name?.message} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[10px] text-zinc-600">City *</label>
          <input
            {...register("city")}
            className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-[12px] text-zinc-300 outline-none focus:border-[#10B981]/30"
          />
          <FieldError message={errors.city?.message} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-zinc-600">Tax Rate (%) *</label>
          <input
            type="number"
            step="0.01"
            {...register("tax_rate")}
            className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-[12px] text-zinc-300 outline-none focus:border-[#10B981]/30"
          />
          <FieldError message={errors.tax_rate?.message} />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[10px] text-zinc-600">Timezone *</label>
        <select
          {...register("timezone")}
          className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-[12px] text-zinc-300 outline-none focus:border-[#10B981]/30"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz} className="bg-zinc-900">
              {tz.split("/").pop()?.replace("_", " ")}
            </option>
          ))}
        </select>
        <FieldError message={errors.timezone?.message} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[10px] text-zinc-600">Address</label>
          <input
            {...register("address")}
            className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-[12px] text-zinc-300 outline-none focus:border-[#10B981]/30"
          />
          <FieldError message={errors.address?.message} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-zinc-600">State</label>
          <input
            {...register("state")}
            className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-[12px] text-zinc-300 outline-none focus:border-[#10B981]/30"
          />
          <FieldError message={errors.state?.message} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[10px] text-zinc-600">Postal Code</label>
          <input
            {...register("postal_code")}
            className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-[12px] text-zinc-300 outline-none focus:border-[#10B981]/30"
          />
          <FieldError message={errors.postal_code?.message} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-zinc-600">Phone</label>
          <input
            {...register("phone")}
            className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-[12px] text-zinc-300 outline-none focus:border-[#10B981]/30"
          />
          <FieldError message={errors.phone?.message} />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[10px] text-zinc-600">Email</label>
        <input
          {...register("email")}
          className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-[12px] text-zinc-300 outline-none focus:border-[#10B981]/30"
        />
        <FieldError message={errors.email?.message} />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-[rgba(255,255,255,0.06)] pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-[12px] text-zinc-500 hover:text-zinc-300"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-b from-[#10B981] to-[#059669] px-4 py-1.5 text-[12px] font-semibold text-black disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : null}
          Create
        </button>
      </div>
    </form>
  );
}
