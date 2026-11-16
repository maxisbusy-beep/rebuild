// Progress: charts, records and the training calendar (built in phase 4).
import { emptyState, pageHeader } from '../ui.js';

export async function render(root) {
  root.append(
    pageHeader('Progress'),
    emptyState({
      iconName: 'progress',
      title: 'Nothing to chart yet',
      text: 'Strength charts, weekly volume, records and your training calendar will appear here.',
    }));
}
