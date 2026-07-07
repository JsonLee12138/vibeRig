import { cancel } from '@clack/prompts'

export const cancelPrompt = (message = 'Operation cancelled.') => {
  cancel(message)
  process.exit(0)
}
