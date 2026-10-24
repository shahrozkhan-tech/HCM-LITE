"use client";

import { useId } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const PALETTE = ["#6366f1", "#a855f7", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];

const axisProps = {
  stroke: "hsl(240 5% 55%)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

const tooltipStyle = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid hsl(240 7% 88%)",
    background: "hsl(0 0% 100%)",
    fontSize: 12,
    color: "hsl(240 12% 12%)",
    boxShadow: "0 12px 30px -10px rgba(99,102,241,.35)",
  },
  labelStyle: { fontWeight: 700, marginBottom: 4 },
  cursor: { fill: "hsl(243 75% 59% / 0.06)" },
};

function ChartFrame({ title, subtitle, children, height = 260 }) {
  return (
    <div className="animate-fade-in">
      {title && (
        <div className="mb-2">
          <p className="text-sm font-semibold">{title}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
      )}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Grads({ id }) {
  return (
    <defs>
      <linearGradient id={`bar-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#818cf8" stopOpacity={0.95} />
        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.75} />
      </linearGradient>
      <linearGradient id={`bar2-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#e879f9" stopOpacity={0.95} />
        <stop offset="100%" stopColor="#a855f7" stopOpacity={0.8} />
      </linearGradient>
      <linearGradient id={`line-${id}`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#6366f1" />
        <stop offset="60%" stopColor="#a855f7" />
        <stop offset="100%" stopColor="#ec4899" />
      </linearGradient>
    </defs>
  );
}

export function BarChartCard({ title, subtitle, data, xKey, series, height }) {
  const id = useId().replace(/:/g, "");
  const grads = [`url(#bar-${id})`, `url(#bar2-${id})`];
  return (
    <ChartFrame title={title} subtitle={subtitle} height={height}>
      <BarChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <Grads id={id} />
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(240 7% 90%)" />
        <XAxis
          dataKey={xKey}
          {...axisProps}
          interval={0}
          angle={data.length > 6 ? -25 : 0}
          textAnchor={data.length > 6 ? "end" : "middle"}
          height={data.length > 6 ? 46 : 26}
        />
        <YAxis {...axisProps} />
        <Tooltip {...tooltipStyle} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name ?? s.key}
            fill={s.color ?? grads[i % grads.length]}
            radius={[7, 7, 0, 0]}
            maxBarSize={38}
            animationDuration={900}
            animationEasing="ease-out"
          />
        ))}
      </BarChart>
    </ChartFrame>
  );
}

export function LineChartCard({ title, subtitle, data, xKey, series, height }) {
  const id = useId().replace(/:/g, "");
  return (
    <ChartFrame title={title} subtitle={subtitle} height={height}>
      <LineChart data={data} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
        <Grads id={id} />
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(240 7% 90%)" />
        <XAxis dataKey={xKey} {...axisProps} tickFormatter={(v) => String(v).slice(5)} />
        <YAxis {...axisProps} domain={[0, 100]} />
        <Tooltip {...tooltipStyle} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />}
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name ?? s.key}
            stroke={s.color ?? (i === 0 ? `url(#line-${id})` : PALETTE[i % PALETTE.length])}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
            connectNulls
            animationDuration={1100}
            animationEasing="ease-out"
          />
        ))}
      </LineChart>
    </ChartFrame>
  );
}

export function PieChartCard({ title, subtitle, data, height }) {
  return (
    <ChartFrame title={title} subtitle={subtitle} height={height}>
      <PieChart>
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="82%"
          paddingAngle={4}
          cornerRadius={7}
          animationDuration={900}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
      </PieChart>
    </ChartFrame>
  );
}
