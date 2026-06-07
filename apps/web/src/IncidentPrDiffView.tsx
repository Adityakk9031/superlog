import { parsePatchFiles, type FileDiffMetadata } from "@pierre/diffs";
import { FileDiff, PatchDiff } from "@pierre/diffs/react";
import { useMemo, useState } from "react";

const DIFF_OPTIONS = {
  theme: "pierre-dark",
  themeType: "dark",
  diffStyle: "unified",
  overflow: "wrap",
  hunkSeparators: "line-info-basic",
  diffIndicators: "bars",
} as const;

export default function IncidentPrDiffView({
  patch,
  patchKey,
}: {
  patch: string;
  patchKey: string;
}) {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const files = useMemo(() => parsePrPatchFiles(patch), [patch]);
  const selectedFile = selectedFileName
    ? (files.find((file) => file.name === selectedFileName) ?? null)
    : null;

  return (
    <div className="grid min-h-[520px] grid-cols-[190px_minmax(0,1fr)] overflow-hidden rounded-md border border-border bg-surface">
      <FileTree files={files} selectedFileName={selectedFileName} onSelect={setSelectedFileName} />
      <div className="min-w-0 overflow-auto bg-[#0d0d0f]">
        {selectedFile ? (
          <FileDiff
            key={`${patchKey}:${selectedFile.name}`}
            fileDiff={selectedFile}
            options={DIFF_OPTIONS}
            disableWorkerPool
          />
        ) : (
          <PatchDiff key={patchKey} patch={patch} options={DIFF_OPTIONS} disableWorkerPool />
        )}
      </div>
    </div>
  );
}

function parsePrPatchFiles(patch: string): FileDiffMetadata[] {
  try {
    return parsePatchFiles(patch, "incident-pr", true).flatMap((parsed) => parsed.files);
  } catch {
    return [];
  }
}

function FileTree({
  files,
  selectedFileName,
  onSelect,
}: {
  files: FileDiffMetadata[];
  selectedFileName: string | null;
  onSelect: (name: string | null) => void;
}) {
  return (
    <aside className="border-r border-border bg-bg/80">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`flex h-9 w-full items-center justify-between border-b border-border px-3 text-left text-[12px] ${
          selectedFileName === null ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"
        }`}
      >
        <span>All files</span>
        <span className="font-mono text-[11px] text-subtle">{files.length}</span>
      </button>
      <div className="max-h-[480px] overflow-y-auto py-1">
        {files.length === 0 ? (
          <p className="px-3 py-2 text-[12px] text-muted">No file list</p>
        ) : (
          files.map((file) => (
            <button
              key={file.name}
              type="button"
              onClick={() => onSelect(file.name)}
              className={`block w-full truncate px-3 py-1.5 text-left font-mono text-[11px] ${
                selectedFileName === file.name
                  ? "bg-surface-2 text-fg"
                  : "text-muted hover:bg-surface hover:text-fg"
              }`}
              title={file.name}
            >
              {file.name}
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
