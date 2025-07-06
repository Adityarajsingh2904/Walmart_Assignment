import React, { useState } from 'react';
import { Modal, Button, Textarea, Toast } from 'shadcn/ui';
import { useMutation, useQueryClient } from 'react-query';
import { z } from 'zod';

const feedbackSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;

interface FeedbackModalProps {
  alertId: string;
}

export default function FeedbackModal({ alertId }: FeedbackModalProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [toastState, setToastState] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: FeedbackInput) => {
      const res = await fetch('/ai-service/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, reason: data.reason }),
      });
      if (!res.ok) throw new Error('Request failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['/api/alerts']);
      setOpen(false);
      setReason('');
      setToastState({ type: 'success', message: 'Feedback submitted' });
    },
    onError: () => {
      setToastState({ type: 'error', message: 'Failed to submit feedback' });
    },
  });

  const valid = feedbackSchema.safeParse({ reason }).success;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    mutation.mutate({ reason });
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog">
        Mark False
      </Button>
      <Modal open={open} onOpenChange={setOpen} aria-labelledby="feedback-title">
        <Modal.Content className="space-y-4">
          <Modal.Title id="feedback-title">Mark False Positive</Modal.Title>
          <form onSubmit={handleSubmit} className="space-y-2">
            <label className="flex flex-col gap-1">
              <span>Reason</span>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="resize-y"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!valid || mutation.isPending}>
                {mutation.isPending ? 'Submitting...' : 'Submit'}
              </Button>
            </div>
          </form>
        </Modal.Content>
      </Modal>
      {toastState && (
        <Toast open variant={toastState.type} onOpenChange={() => setToastState(null)}>
          {toastState.message}
        </Toast>
      )}
    </>
  );
}
