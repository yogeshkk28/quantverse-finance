/**
 * Shaded fill between two indicator lines (Bollinger, Keltner, Donchian, Ichimoku cloud).
 * lightweight-charts has no built-in band series, so this primitive paints it behind the candles.
 */
import type { IChartApi, IPrimitivePaneView, ISeriesPrimitive, SeriesAttachedParameter, Time, UTCTimestamp } from "lightweight-charts";

export interface BandPoint {
  time: number;
  upper: number;
  lower: number;
}

export class BandFill implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: SeriesAttachedParameter<Time>["series"] | null = null;

  constructor(private points: BandPoint[], private color: string, private colorAlt?: string) {}

  attached(p: SeriesAttachedParameter<Time>) {
    this.chart = p.chart as IChartApi;
    this.series = p.series;
  }

  detached() {
    this.chart = null;
    this.series = null;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    const self = this;
    return [
      {
        zOrder: () => "bottom",
        renderer: () => ({
          draw() {},
          drawBackground(target) {
            const chart = self.chart, series = self.series;
            if (!chart || !series) return;
            const ts = chart.timeScale();
            target.useMediaCoordinateSpace(({ context: c }) => {
              let prev: { x: number; u: number; l: number; up: boolean } | null = null;
              for (const pt of self.points) {
                const x = ts.timeToCoordinate(pt.time as UTCTimestamp);
                const u = series.priceToCoordinate(pt.upper);
                const l = series.priceToCoordinate(pt.lower);
                if (x === null || u === null || l === null) {
                  prev = null;
                  continue;
                }
                const up = pt.upper >= pt.lower;
                if (prev) {
                  c.fillStyle = !self.colorAlt || prev.up ? self.color : self.colorAlt;
                  c.beginPath();
                  c.moveTo(prev.x, prev.u);
                  c.lineTo(x, u);
                  c.lineTo(x, l);
                  c.lineTo(prev.x, prev.l);
                  c.closePath();
                  c.fill();
                }
                prev = { x, u, l, up };
              }
            });
          },
        }),
      },
    ];
  }
}
