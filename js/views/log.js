// Log: history of lifting and bike sessions (built in phases 2 and 3).
import { emptyState, pageHeader } from '../ui.js';

export async function render(root) {
  root.append(
    pageHeader('Log'),
    emptyState({
      iconName: 'barbell',
      title: 'No sessions yet',
      text: 'Your lifting and bike sessions will be listed here once logging is built.',
    }));
}
