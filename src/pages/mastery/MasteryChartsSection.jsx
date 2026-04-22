import React from 'react';
import { motion as _MOTION } from 'framer-motion';
import { Brain, Zap } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const useChartDimensions = () => {
  const containerRef = React.useRef(null);
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    let rafId = 0;

    const measure = () => {
      const rect = node.getBoundingClientRect();
      const width = Math.max(0, Math.floor(rect.width));
      const height = Math.max(0, Math.floor(rect.height));

      setDimensions((previous) => {
        if (previous.width === width && previous.height === height) {
          return previous;
        }
        return { width, height };
      });
    };

    const scheduleMeasure = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();

    if (typeof window.ResizeObserver === 'function') {
      const observer = new window.ResizeObserver(() => {
        scheduleMeasure();
      });
      observer.observe(node);

      return () => {
        if (rafId) window.cancelAnimationFrame(rafId);
        observer.disconnect();
      };
    }

    window.addEventListener('resize', scheduleMeasure);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, []);

  return [containerRef, dimensions];
};

const MasteryChartsSection = React.memo(function MasteryChartsSection({
  activityData,
  qualityVector,
  itemVariants,
}) {
  const [reviewChartRef, reviewChartDimensions] = useChartDimensions();
  const [vectorChartRef, vectorChartDimensions] = useChartDimensions();
  const hasReviewChartSize = reviewChartDimensions.width > 1 && reviewChartDimensions.height > 1;
  const hasVectorChartSize = vectorChartDimensions.width > 1 && vectorChartDimensions.height > 1;

  return (
    <>
      <_MOTION.div className="chart-card wide" variants={itemVariants}>
        <div className="chart-header">
          <Zap size={16} />
          <h4>Review Load and Retention (14 Days)</h4>
        </div>
        <div className="chart-body" ref={reviewChartRef}>
          {hasReviewChartSize ? (
            <AreaChart
              width={reviewChartDimensions.width}
              height={reviewChartDimensions.height}
              data={activityData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorReviews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
              <XAxis
                dataKey="dateLabel"
                stroke="var(--secondary)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="reviews"
                stroke="var(--secondary)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="retention"
                orientation="right"
                stroke="#34d399"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''}
                formatter={(value, seriesName) => {
                  if (seriesName === 'Retention') {
                    return [`${Number(value).toFixed(1)}%`, seriesName];
                  }
                  return [Math.round(Number(value)), seriesName];
                }}
                contentStyle={{
                  backgroundColor: 'rgba(10,10,10,0.9)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  color: 'var(--primary)',
                }}
                itemStyle={{ color: 'var(--primary)' }}
              />
              <Area
                yAxisId="reviews"
                name="Reviews"
                type="monotone"
                dataKey="reviews"
                stroke="var(--primary)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorReviews)"
                dot={false}
              />
              <Area
                yAxisId="retention"
                name="Retention"
                type="monotone"
                dataKey="retention"
                stroke="#34d399"
                strokeWidth={2}
                fillOpacity={0}
                dot={false}
              />
            </AreaChart>
          ) : null}
        </div>
      </_MOTION.div>

      <_MOTION.div className="chart-card" variants={itemVariants}>
        <div className="chart-header">
          <Brain size={16} />
          <h4>Learning Quality Vector</h4>
        </div>
        <div className="chart-body" ref={vectorChartRef}>
          {hasVectorChartSize ? (
            <RadarChart
              width={vectorChartDimensions.width}
              height={vectorChartDimensions.height}
              cx="50%"
              cy="50%"
              outerRadius="65%"
              data={qualityVector}
            >
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: 'var(--secondary)', fontSize: 10, fontFamily: 'var(--font-body)' }}
              />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar
                name="Learning Profile"
                dataKey="value"
                stroke="var(--primary)"
                fill="var(--primary)"
                fillOpacity={0.2}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(10,10,10,0.9)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                }}
              />
            </RadarChart>
          ) : null}
        </div>
      </_MOTION.div>
    </>
  );
});

export default MasteryChartsSection;
