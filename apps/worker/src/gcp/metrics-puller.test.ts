import { strict as assert } from "node:assert";
import { test } from "node:test";
import { runGcpMetricsPullOnce } from "./metrics-puller.js";

test("the metrics puller spends only the remaining series budget and checkpoints after delivery", async () => {
  const pageSizes: number[] = [];
  const reservations: Array<{ month: string; requested: number; monthlyLimit: number }> = [];
  const savedCursors: Date[] = [];
  const forwarded: unknown[] = [];
  const now = new Date("2026-07-13T12:00:00Z");
  let seriesRead = 99_999_999;

  const stats = await runGcpMetricsPullOnce({
    now: () => now,
    monthlySeriesLimit: 100_000_000,
    store: {
      async listConnected() {
        return [
          {
            id: "connection-id",
            projectId: "superlog-project-id",
            gcpProjectId: "acme-production",
            metricsCursor: new Date("2026-07-13T11:55:00Z"),
            metricsBudgetMonth: "2026-07",
            metricsSeriesRead: 99_999_999,
            ingestKey: "sl_public_test",
          },
        ];
      },
      async reserveBudget(_id, reservation) {
        reservations.push(reservation);
        const reserved = Math.min(reservation.requested, reservation.monthlyLimit - seriesRead);
        seriesRead += reserved;
        return reserved;
      },
      async refundBudget(_id, refund) {
        seriesRead -= refund.series;
      },
      async saveCursor(_id, cursor) {
        savedCursors.push(cursor);
      },
    },
    monitoring: {
      async listTimeSeries(input) {
        pageSizes.push(input.pageSize);
        return {
          timeSeries: [
            {
              metric: { type: "compute.googleapis.com/instance/cpu/utilization" },
              resource: {
                type: "gce_instance",
                labels: {
                  project_id: "acme-production",
                  instance_id: "123",
                  zone: "us-central1-a",
                },
              },
              metricKind: "GAUGE",
              valueType: "DOUBLE",
              points: [
                {
                  interval: { endTime: "2026-07-13T11:59:00Z" },
                  value: { doubleValue: 0.42 },
                },
              ],
            },
          ],
        };
      },
    },
    async forward(input) {
      forwarded.push(input.payload);
      assert.equal(input.ingestKey, "sl_public_test");
      return true;
    },
  });

  assert.deepEqual(pageSizes, [1]);
  assert.equal(forwarded.length, 1);
  assert.deepEqual(reservations, [
    { month: "2026-07", requested: 1_000, monthlyLimit: 100_000_000 },
    { month: "2026-07", requested: 1_000, monthlyLimit: 100_000_000 },
  ]);
  assert.equal(seriesRead, 100_000_000);
  assert.deepEqual(savedCursors, [now]);
  assert.deepEqual(stats, { connections: 1, seriesRead: 1, pointsForwarded: 1, errors: 0 });
});

test("a failed intake still spends the read budget but does not advance the data cursor", async () => {
  const reservations: number[] = [];
  const savedCursors: Date[] = [];
  let remaining = 1;
  await runGcpMetricsPullOnce({
    now: () => new Date("2026-07-13T12:00:00Z"),
    monthlySeriesLimit: 10,
    store: {
      async listConnected() {
        return [
          {
            id: "connection-id",
            projectId: "project-id",
            gcpProjectId: "acme-production",
            metricsCursor: new Date("2026-07-13T11:55:00Z"),
            metricsBudgetMonth: "2026-07",
            metricsSeriesRead: 9,
            ingestKey: "sl_public_test",
          },
        ];
      },
      async reserveBudget(_id, reservation) {
        reservations.push(reservation.requested);
        const reserved = Math.min(remaining, reservation.requested);
        remaining -= reserved;
        return reserved;
      },
      async refundBudget() {
        throw new Error("a full page must not be refunded");
      },
      async saveCursor(_id, cursor) {
        savedCursors.push(cursor);
      },
    },
    monitoring: {
      async listTimeSeries() {
        return {
          timeSeries: [
            {
              metric: { type: "compute.googleapis.com/instance/cpu/utilization" },
              resource: { type: "gce_instance", labels: { project_id: "acme-production" } },
              metricKind: "GAUGE",
              points: [
                { interval: { endTime: "2026-07-13T11:59:00Z" }, value: { doubleValue: 0.5 } },
              ],
            },
          ],
        };
      },
    },
    async forward() {
      return false;
    },
  });
  assert.deepEqual(reservations, [1_000, 1_000]);
  assert.deepEqual(savedCursors, []);
});

test("no paid Monitoring call starts when the atomic database reservation is exhausted", async () => {
  let monitoringCalls = 0;
  await runGcpMetricsPullOnce({
    now: () => new Date("2026-07-13T12:00:00Z"),
    monthlySeriesLimit: 10,
    store: {
      async listConnected() {
        return [
          {
            id: "connection-id",
            projectId: "project-id",
            gcpProjectId: "acme-production",
            metricsCursor: null,
            metricsBudgetMonth: "2026-07",
            metricsSeriesRead: 10,
            ingestKey: "sl_public_test",
          },
        ];
      },
      async reserveBudget() {
        return 0;
      },
      async refundBudget() {},
      async saveCursor() {},
    },
    monitoring: {
      async listTimeSeries() {
        monitoringCalls += 1;
        return { timeSeries: [] };
      },
    },
    async forward() {
      return true;
    },
  });
  assert.equal(monitoringCalls, 0);
});

test("overlap reads do not forward metric points at or before the delivered cursor", async () => {
  const forwarded: Array<{
    resourceMetrics: Array<{
      scopeMetrics: Array<{ metrics: Array<{ gauge: { dataPoints: unknown[] } }> }>;
    }>;
  }> = [];
  const starts: Date[] = [];
  const cursor = new Date("2026-07-13T11:55:00Z");
  const stats = await runGcpMetricsPullOnce({
    now: () => new Date("2026-07-13T12:00:00Z"),
    monthlySeriesLimit: 10,
    store: {
      async listConnected() {
        return [
          {
            id: "connection-id",
            projectId: "project-id",
            gcpProjectId: "acme-production",
            metricsCursor: cursor,
            metricsBudgetMonth: "2026-07",
            metricsSeriesRead: 0,
            ingestKey: "sl_public_test",
          },
        ];
      },
      async reserveBudget(_id, reservation) {
        return reservation.requested;
      },
      async refundBudget() {},
      async saveCursor() {},
    },
    monitoring: {
      async listTimeSeries(input) {
        starts.push(input.startTime);
        if (starts.length > 1) return { timeSeries: [] };
        return {
          timeSeries: [
            {
              metric: { type: "compute.googleapis.com/instance/cpu/utilization" },
              resource: { type: "gce_instance" },
              metricKind: "GAUGE",
              points: [
                {
                  interval: { endTime: "2026-07-13T11:54:00Z" },
                  value: { doubleValue: 0.4 },
                },
                {
                  interval: { endTime: "2026-07-13T11:56:00Z" },
                  value: { doubleValue: 0.5 },
                },
              ],
            },
          ],
        };
      },
    },
    async forward({ payload }) {
      forwarded.push(payload as (typeof forwarded)[number]);
      return true;
    },
  });

  assert.equal(starts[0]?.toISOString(), "2026-07-13T11:45:00.000Z");
  assert.equal(
    forwarded[0]?.resourceMetrics[0]?.scopeMetrics[0]?.metrics[0]?.gauge.dataPoints.length,
    1,
  );
  assert.equal(stats.pointsForwarded, 1);
});
