"use client";

import {
  ArrowLeftRight,
  Download,
  Info,
  LogOut,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { PlanningSettingsFields } from "@/components/planner/planning-settings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportState, importState } from "@/lib/state/persistence";
import { activeProfileOf, useAppStore } from "@/lib/state/store";

type Open = null | "settings" | "reset" | "import";

export function SettingsMenu() {
  const router = useRouter();
  const plan = usePlanContext();
  const isDemo = useAppStore((s) => s.activeProfile === "demo");
  const profile = useAppStore((s) => activeProfileOf(s));
  const { resetProgress, resetDemo, exitDemo, replaceState } = useAppStore.getState();
  const [open, setOpen] = useState<Open>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const download = () => {
    const s = useAppStore.getState();
    const text = exportState({ version: s.version, activeProfile: s.activeProfile, personal: s.personal, demo: s.demo });
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `unipath-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Progress exported", { description: "Keep the file to restore your plan in another browser." });
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    const result = importState(await file.text());
    if ("error" in result) {
      setImportError(result.error);
      return;
    }
    replaceState(result.state);
    setOpen(null);
    setImportError(null);
    toast("Progress imported", { description: "Your saved plan was replaced with the imported one." });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="Settings and data">
            <Settings />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Plan</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setOpen("settings")}>
            <SlidersHorizontal /> Planning settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push("/start")}>
            <ArrowLeftRight /> {isDemo ? "Start my own plan" : "Switch major"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Your data</DropdownMenuLabel>
          <DropdownMenuItem onSelect={download}>
            <Download /> Export progress
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setOpen("import")}>
            <Upload /> Import progress
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/about">
              <Info /> About the data
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isDemo ? (
            <>
              <DropdownMenuItem
                onSelect={() => {
                  resetDemo();
                  toast("Sample student reset");
                }}
              >
                <RotateCcw /> Reset sample student
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  exitDemo();
                  router.push(useAppStore.getState().personal ? "/overview" : "/");
                }}
              >
                <LogOut /> Exit demo
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onSelect={() => setOpen("reset")} className="text-danger [&_svg]:!text-danger">
              <RotateCcw /> Reset progress…
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open === "settings"} onOpenChange={(o) => setOpen(o ? "settings" : null)}>
        <DialogContent
          title="Planning settings"
          description="Changes apply to your plan right away."
          footer={
            <DialogClose asChild>
              <Button>Done</Button>
            </DialogClose>
          }
        >
          {profile && <PlanningSettingsFields preferences={profile.preferences} />}
        </DialogContent>
      </Dialog>

      <Dialog open={open === "reset"} onOpenChange={(o) => setOpen(o ? "reset" : null)}>
        <DialogContent
          title={`Reset progress for ${plan.curriculum.majorName}?`}
          description="This clears your completed courses, next-semester plan and elective choices for this major in this browser."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DialogClose>
              <Button
                variant="danger"
                onClick={() => {
                  resetProgress();
                  setOpen(null);
                  toast("Progress reset", { description: `${plan.curriculum.majorName} is back to a fresh start.` });
                }}
              >
                Reset progress
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted">
            This can&apos;t be undone. If you might want it back, <strong className="text-fg">export your progress</strong>{" "}
            first from the settings menu.
          </p>
        </DialogContent>
      </Dialog>

      <Dialog
        open={open === "import"}
        onOpenChange={(o) => {
          setOpen(o ? "import" : null);
          setImportError(null);
        }}
      >
        <DialogContent
          title="Import progress"
          description="Choose a file you exported from UniPath. It replaces the progress saved in this browser."
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="UniPath export file"
            onChange={(e) => onImportFile(e.target.files?.[0])}
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload /> Choose file
          </Button>
          {importError && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {importError}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
