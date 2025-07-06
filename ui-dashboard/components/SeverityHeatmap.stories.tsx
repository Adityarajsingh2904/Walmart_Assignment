import type { Meta, StoryObj } from '@storybook/react';
import SeverityHeatmap, { DayData } from './SeverityHeatmap';

const meta: Meta<typeof SeverityHeatmap> = {
  title: 'Components/SeverityHeatmap',
  component: SeverityHeatmap,
  argTypes: {
    data: { control: 'object' },
  },
};
export default meta;

const today = new Date();
const baseData: DayData[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(today);
  date.setDate(today.getDate() - i);
  const iso = date.toISOString().slice(0, 10);
  return { date: iso, low: 0, medium: 0, high: Math.floor(Math.random() * 8) };
}).reverse();

type Story = StoryObj<typeof SeverityHeatmap>;

export const Default: Story = {
  args: {
    data: baseData,
  },
};

export const SparseData: Story = {
  args: {
    data: baseData.map((d) => ({ ...d, high: d.high > 4 ? 0 : d.high })),
  },
};

export const DenseData: Story = {
  args: {
    data: baseData.map((d) => ({ ...d, high: Math.min(8, d.high + 3) })),
  },
};
