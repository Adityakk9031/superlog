import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AddFilter,
  GroupBySelect,
  MetricNamePicker,
  SegmentedToggle,
} from "../Explore.tsx";
import { METRIC_AGGREGATIONS, type ExploreRange } from "../api.ts";
import { Btn, Chip, FieldLabel, Input, Label, Tile } from "../design/ui.tsx";
import { type Widget, type WidgetConfig, type WidgetType, defaultChartType, defaultLayoutFor } from "./types.ts";
import {
  type WidgetFormState,
  buildWidgetConfig,
  generateTitle,
  widgetTypeFor,
} from "./widget-config.ts";
import { WidgetBody } from "./widgets/WidgetBody.tsx";

export function WidgetForm({
  projectId,
  range,
  mode,
  initial,
  existingTitle,
  submitting,
  onSubmit,
  onClose,
}: {
  projectId: string;
  range: ExploreRange;
  mode: "create" | "edit";
  initial: WidgetFormState;
  // When editing, the widget's current title is preserved (it stays
  // independently renamable from the widget header) instead of being
  // regenerated from the form.
  existingTitle?: string;
  submitting: boolean;
  onSubmit: (result: {
    type: WidgetType;
    config: WidgetConfig;
    title: string;
  }) => void | Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<WidgetFormState>(initial);
  const [filterOpen, setFilterOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (patch: Partial<WidgetFormState>) => setForm((f) => ({ ...f, ...patch }));

  const { kind, source } = form;
  const type = widgetTypeFor(kind, source);
  const isChart = kind === "chart";
  const isMetric = isChart && source === "metric";
  const isTable = kind === "table";
  const isNote = kind === "note";

  // tables can't show metrics — bounce back to logs if user switches to table
  useEffect(() => {
    if (kind === "table" && source === "metric") update({ source: "logs" });
  }, [kind, source]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const config = useMemo(() => buildWidgetConfig(form), [form]);
  const generatedTitle = useMemo(
    () =>
      generateTitle({
        kind,
        source,
        metricName: form.metricName,
        groupBy: form.groupBy,
        attrs: form.attrs,
        markdown: form.markdown,
      }),
    [kind, source, form.metricName, form.groupBy, form.attrs, form.markdown],
  );
  const title = mode === "edit" && existingTitle ? existingTitle : generatedTitle;

  const previewWidget = useMemo<Widget>(
    () => ({
      id: "__preview__",
      dashboardId: "__preview__",
      type,
      title,
      config,
      layout: defaultLayoutFor(type),
      position: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    [type, title, config],
  );

  const disabled = (isMetric && !form.metricName) || (isNote && !form.markdown.trim());

  const submit = async () => {
    if (disabled) return;
    setError(null);
    try {
      // The parent's onSubmit awaits its mutation and only closes the modal on
      // success — so a failed save keeps the form open with the error shown
      // instead of becoming an unhandled rejection.
      await onSubmit({ type, config, title });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save widget");
    }
  };

  const sourceOptions = isChart
    ? [
        { value: "metric", label: "metric" },
        { value: "traces", label: "traces" },
        { value: "logs", label: "logs" },
      ]
    : [
        { value: "traces", label: "traces" },
        { value: "logs", label: "logs" },
      ];

  // Render through a portal to <body>: dashboard widget tiles are positioned
  // with CSS transforms (react-grid-layout) and clip overflow, which would
  // otherwise trap this `position: fixed` overlay inside a single tile.
  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg/70 px-4 py-12 backdrop-blur-md"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClose();
      }}
    >
      <div
        role="presentation"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="w-full max-w-2xl"
      >
        <Tile className="bg-bg shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <Label>{mode === "edit" ? "edit widget" : "add widget"}</Label>
              <div className="mt-1 text-[18px] font-medium text-fg">{title}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-[11px] uppercase tracking-[0.2em] text-subtle hover:text-fg"
            >
              close
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <FieldLabel>kind</FieldLabel>
              <SegmentedToggle
                value={kind}
                options={[
                  { value: "chart", label: "chart" },
                  { value: "table", label: "table" },
                  { value: "note", label: "note" },
                ]}
                onChange={(v) => update({ kind: v as WidgetFormState["kind"] })}
              />
            </div>

            {!isNote && (
              <div>
                <FieldLabel>source</FieldLabel>
                <SegmentedToggle
                  value={source}
                  options={sourceOptions}
                  onChange={(v) => update({ source: v as WidgetFormState["source"] })}
                />
              </div>
            )}

            {isChart && (
              <div>
                <FieldLabel>chart type</FieldLabel>
                <SegmentedToggle
                  value={form.chartType ?? defaultChartType(type)}
                  options={[
                    { value: "line", label: "line" },
                    { value: "bar", label: "bar" },
                  ]}
                  onChange={(v) => update({ chartType: v as WidgetFormState["chartType"] })}
                />
              </div>
            )}

            {isMetric && (
              <div>
                <FieldLabel>metric</FieldLabel>
                <MetricNamePicker
                  projectId={projectId}
                  range={range}
                  value={form.metricName}
                  onChange={(v) => update({ metricName: v })}
                />
              </div>
            )}

            {isMetric && (
              <div>
                <FieldLabel>aggregation</FieldLabel>
                <SegmentedToggle
                  value={form.aggregation}
                  options={["auto", ...METRIC_AGGREGATIONS].map((a) => ({ value: a, label: a }))}
                  onChange={(v) => update({ aggregation: v as WidgetFormState["aggregation"] })}
                />
              </div>
            )}

            {isChart && (
              <div>
                <FieldLabel>group by</FieldLabel>
                <GroupBySelect
                  projectId={projectId}
                  range={range}
                  source={source === "metric" ? undefined : source}
                  value={form.groupBy}
                  onChange={(g) => update({ groupBy: g })}
                  shortcut={false}
                  triggerLabel=""
                />
              </div>
            )}

            {isChart && form.groupBy && (
              <div>
                <FieldLabel>top series</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  step={1}
                  value={form.seriesLimit}
                  onChange={(e) =>
                    update({
                      seriesLimit: Math.max(1, Math.min(50, Number(e.target.value) || 10)),
                    })
                  }
                />
                <div className="mt-1 font-mono text-[10px] text-subtle">
                  remaining groups roll into “Other”
                </div>
              </div>
            )}

            {isTable && (
              <div>
                <FieldLabel>row limit</FieldLabel>
                <Input
                  type="number"
                  min={10}
                  max={500}
                  step={10}
                  value={form.rowLimit}
                  onChange={(e) =>
                    update({ rowLimit: Math.max(10, Math.min(500, Number(e.target.value) || 50)) })
                  }
                />
              </div>
            )}

            {isChart && (
              <div>
                <FieldLabel>display</FieldLabel>
                <div className="flex flex-col gap-2">
                  <Toggle
                    label="x-axis markers"
                    checked={form.showXAxis}
                    onChange={(v) => update({ showXAxis: v })}
                  />
                  <Toggle
                    label="y-axis markers"
                    checked={form.showYAxis}
                    onChange={(v) => update({ showYAxis: v })}
                  />
                  <Toggle
                    label="legend"
                    checked={form.showLegend}
                    onChange={(v) => update({ showLegend: v })}
                  />
                  {form.showLegend && (
                    <div className="pt-1">
                      <SegmentedToggle
                        value={form.legendPosition}
                        options={[
                          { value: "side", label: "side" },
                          { value: "bottom", label: "bottom" },
                        ]}
                        onChange={(v) =>
                          update({ legendPosition: v as WidgetFormState["legendPosition"] })
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {isNote && (
              <div>
                <FieldLabel>markdown</FieldLabel>
                <textarea
                  value={form.markdown}
                  onChange={(e) => update({ markdown: e.target.value })}
                  className="min-h-40 w-full resize-y rounded-sm border border-border bg-surface-2 px-3 py-2 font-mono text-[12px] leading-relaxed text-fg placeholder:text-subtle focus:border-border-strong focus:outline-none"
                />
              </div>
            )}

            {!isNote && (
              <div>
                <FieldLabel>filters</FieldLabel>
                <div className="flex flex-wrap items-center gap-2">
                  {form.attrs.map((a, i) => (
                    <button
                      type="button"
                      key={`${a.key}=${a.value}-${i}`}
                      onClick={() => update({ attrs: form.attrs.filter((_, j) => j !== i) })}
                      title="remove"
                    >
                      <Chip tone="accent">
                        <span className="opacity-70">{a.key}</span>
                        <span>=</span>
                        <span>{a.value}</span>
                        <span className="ml-1 opacity-60">×</span>
                      </Chip>
                    </button>
                  ))}
                  <div className="relative">
                    <Btn variant="secondary" size="sm" onClick={() => setFilterOpen((v) => !v)}>
                      + add filter
                    </Btn>
                    {filterOpen && (
                      <AddFilter
                        projectId={projectId}
                        range={range}
                        source={source === "metric" ? undefined : source}
                        existing={form.attrs}
                        onClose={() => setFilterOpen(false)}
                        onPick={(f) => {
                          if (f.kind === "attr") {
                            update({ attrs: [...form.attrs, { key: f.key, value: f.value }] });
                          }
                          setFilterOpen(false);
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <Label>preview</Label>
            <div className="mt-3 h-[260px] border border-border bg-surface-1 p-4">
              {isMetric && !form.metricName ? (
                <div className="flex h-full items-center justify-center font-mono text-[11px] text-subtle">
                  pick a metric to preview
                </div>
              ) : isNote && !form.markdown.trim() ? (
                <div className="flex h-full items-center justify-center font-mono text-[11px] text-subtle">
                  write a note to preview
                </div>
              ) : (
                <WidgetBody projectId={projectId} range={range} widget={previewWidget} />
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
            {error && (
              <span className="mr-auto font-mono text-[11px] text-danger" role="alert">
                {error}
              </span>
            )}
            <Btn variant="ghost" onClick={onClose}>
              cancel
            </Btn>
            <Btn onClick={submit} loading={submitting} disabled={disabled}>
              {mode === "edit" ? "save changes" : "add widget"}
            </Btn>
          </div>
        </Tile>
      </div>
    </div>,
    document.body,
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between font-mono text-[11px] text-muted hover:text-fg">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 cursor-pointer accent-accent"
      />
    </label>
  );
}
