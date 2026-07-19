import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({});
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions = {}) => {
    setOpts(options);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const finish = (v: boolean) => {
    setOpen(false);
    resolver.current?.(v);
    resolver.current = null;
  };

  const confirmDialog = (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) finish(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{opts.title ?? "Are you sure?"}</AlertDialogTitle>
          {opts.description ? (
            <AlertDialogDescription>{opts.description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => finish(false)}>
            {opts.cancelText ?? "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => finish(true)}
            className={
              opts.destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : ""
            }
          >
            {opts.confirmText ?? "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, confirmDialog };
}

type PromptOptions = {
  title?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  label?: string;
};

export function usePrompt() {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<PromptOptions>({});
  const [value, setValue] = useState("");
  const resolver = useRef<((v: string | null) => void) | null>(null);

  const prompt = useCallback((options: PromptOptions = {}) => {
    setOpts(options);
    setValue(options.defaultValue ?? "");
    setOpen(true);
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const finish = (v: string | null) => {
    setOpen(false);
    resolver.current?.(v);
    resolver.current = null;
  };

  const promptDialog = (
    <Dialog open={open} onOpenChange={(o) => { if (!o) finish(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{opts.title ?? "Enter a value"}</DialogTitle>
          {opts.description ? (
            <DialogDescription>{opts.description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            finish(value);
          }}
          className="space-y-4"
        >
          {opts.label ? (
            <label className="block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {opts.label}
            </label>
          ) : null}
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={opts.placeholder}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => finish(null)}>
              {opts.cancelText ?? "Cancel"}
            </Button>
            <Button type="submit">{opts.confirmText ?? "OK"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return { prompt, promptDialog };
}