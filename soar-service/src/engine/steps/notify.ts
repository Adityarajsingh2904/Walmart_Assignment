import type { Playbook, Step } from '../../playbook/types';
import { WebClient } from '@slack/web-api';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import type { AlertEvent, StepResult, ExecutionCtx } from '../types';
import type { StepType } from '../registry';

interface NotifyStep extends Step {
  type: 'notify';
  channel: string;
  target: string;
  message: string;
}

export async function notify(
  playbook: Playbook,
  step: NotifyStep,
  alert: AlertEvent,
  ctx: ExecutionCtx
): Promise<StepResult> {
  const start = Date.now();
  void playbook;
  void alert;
  void ctx;
  try {
    if (step.channel === 'slack') {
      const client = new WebClient(process.env.SLACK_TOKEN);
      await client.chat.postMessage({ channel: step.target, text: step.message });
    } else if (step.channel === 'sns') {
      const sns = new SNSClient({ region: process.env.AWS_REGION });
      await sns.send(
        new PublishCommand({ TopicArn: process.env.AWS_SNS_TOPIC, Message: step.message })
      );
    }
    return {
      stepId: step.id,
      type: step.type as StepType,
      status: 'success',
      attempts: 1,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      stepId: step.id,
      type: step.type as StepType,
      status: 'failed',
      attempts: 1,
      durationMs: Date.now() - start,
      error: message,
    };
  }
}
