"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { requestCancellation } from "@/actions/preorder";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

export function CancelRequest({ token, alreadyRequested }: { token: string; alreadyRequested: boolean }) {
  const { t } = useI18n();
  const [requested, setRequested] = useState(alreadyRequested);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-sm border border-line p-6">
      <p className="font-display text-xl text-ink">{t.manage.cancelTitle}</p>
      {requested ? (
        <p className="mt-2 text-sm text-ink-muted">{t.manage.cancelRequested}</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink-muted">{t.manage.cancelBody}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(t.manage.cancelConfirm)) return;
              startTransition(async () => {
                const res = await requestCancellation(token);
                if (!res.ok) {
                  toast.error(t.errors[res.error] ?? t.errors.generic);
                  return;
                }
                setRequested(true);
                toast.success(t.manage.cancelRequested);
              });
            }}
          >
            {t.manage.cancelButton}
          </Button>
        </>
      )}
    </div>
  );
}
