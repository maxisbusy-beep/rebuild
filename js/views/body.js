// Body: weekly weight, waist and photo check-ins (built in phase 3).
import { emptyState, pageHeader } from '../ui.js';

export async function render(root) {
  root.append(
    pageHeader('Body'),
    emptyState({
      iconName: 'scale',
      title: 'No check-ins yet',
      text: 'Weekly bodyweight, waist and progress photos will be tracked here.',
    }));
}
