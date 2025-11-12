import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface PricePoint {
  time: string;
  yesPrice: number;
  noPrice: number;
}

interface PriceChartProps {
  data: PricePoint[];
}

const PriceChart = ({ data }: PriceChartProps) => {
  return (
    <div className="p-0 md:p-6">
      <h3 className="text-base sm:text-lg font-semibold text-foreground mb-4 px-4 md:px-0 hidden md:block">Price History</h3>
      <div className="w-full overflow-x-auto px-4 md:px-0">
        <ResponsiveContainer width="100%" height={300} minWidth={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="time" 
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: '10px' }}
              interval="preserveStartEnd"
            />
            <YAxis 
              domain={[0, 1]}
              tickFormatter={(value) => `$${value.toFixed(2)}`}
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: '10px' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '12px'
              }}
              formatter={(value: number) => `$${value.toFixed(2)}`}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line 
              type="monotone" 
              dataKey="yesPrice" 
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              name="Yes Price"
            />
            <Line 
              type="monotone" 
              dataKey="noPrice" 
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              name="No Price"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PriceChart;
