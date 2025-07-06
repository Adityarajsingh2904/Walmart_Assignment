import { WebClient } from '@slack/web-api';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import type { Playbook, Step } from '../playbook/types';
import type { AlertEvent, ExecutionCtx } from '../engine/types';
import type { ActionResult } from './index';

type NotifyStep = Extract<Step, { type: 'notify' }>;

export default async function notify(
  playbook: Playbook,
  step: Step,
  _alert: AlertEvent,
  _ctx: ExecutionCtx
): Promise<ActionResult> {
  const start = Date.now();
  const s = step as NotifyStep;
  let status: 'success' | 'failed' = 'success';
  try {
    if (s.channel === 'slack') {
      const client = new WebClient(process.env.SLACK_TOKEN);
      await client.chat.postMessage({ channel: s.target, text: s.message });
    } else if (s.channel === 'sns') {
      const sns = new SNSClient({ region: process.env.AWS_REGION });
      await sns.send(
        new PublishCommand({ TopicArn: s.target, Message: s.message })
      );
    } else {
      throw new Error(`unknown channel ${s.channel}`);
    }
  } catch (_err) {
    status = 'failed';
  }

  return {
    playbookId: playbook.id,
    stepId: step.id,
    type: s.type,
    status,
    durationMs: Date.now() - start,
    metadata: { mode: s.channel, target: s.target },
  };
}
