import process from 'node:process';
import { cancel } from '@clack/prompts';

export function cancelPrompt(message = 'Operation cancelled.') {
  cancel(message);
  process.exit(0);
}
