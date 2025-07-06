import type { Meta, StoryObj } from '@storybook/react';
import IncidentCard, { Incident } from './IncidentCard';

const meta: Meta<typeof IncidentCard> = {
  title: 'Components/IncidentCard',
  component: IncidentCard,
  argTypes: {
    incident: { control: 'object' },
    onClick: { action: 'clicked' },
  },
};
export default meta;

type Story = StoryObj<typeof IncidentCard>;

const baseIncident: Incident = {
  id: '1',
  title: 'Test Incident',
  severity: 'low',
  timestamp: new Date().toISOString(),
};

export const Default: Story = {
  args: {
    incident: baseIncident,
  },
};

export const LowSeverity: Story = {
  args: {
    incident: { ...baseIncident, severity: 'low' },
  },
};

export const MediumSeverity: Story = {
  args: {
    incident: { ...baseIncident, severity: 'medium' },
  },
};

export const HighSeverity: Story = {
  args: {
    incident: { ...baseIncident, severity: 'high' },
  },
};
