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
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Price History</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="time" 
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            domain={[0, 1]}
            tickFormatter={(value) => `$${value.toFixed(2)}`}
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '12px' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px'
            }}
            formatter={(value: number) => `$${value.toFixed(2)}`}
          />
          <Legend />
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
    </Card>
  );
};

export default PriceChart;
