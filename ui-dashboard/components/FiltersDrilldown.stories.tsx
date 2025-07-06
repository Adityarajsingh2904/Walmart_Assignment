import type { Meta, StoryObj } from '@storybook/react';
import FiltersDrilldown, { FilterCategory } from './FiltersDrilldown';

const meta: Meta<typeof FiltersDrilldown> = {
  title: 'Components/FiltersDrilldown',
  component: FiltersDrilldown,
  argTypes: {
    categories: { control: 'object' },
    onFilterChange: { action: 'filter change' },
  },
};
export default meta;

type Story = StoryObj<typeof FiltersDrilldown>;

const categories: FilterCategory[] = [
  {
    name: 'Region',
    fetchOptions: async () => ['US', 'EU', 'APAC'],
  },
  {
    name: 'Country',
    fetchOptions: async (sel: string[]) => {
      const region = sel[0];
      if (region === 'US') return ['USA'];
      if (region === 'EU') return ['Germany', 'France'];
      return ['Japan'];
    },
  },
];

export const Default: Story = {
  args: {
    categories,
  },
};
