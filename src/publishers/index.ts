import { ActionInputs, Publisher } from '../types/domain';

import { ConfluencePublisher } from './confluence';
import { GitPublisher } from './git';

export function createPublishers(config: ActionInputs): Publisher[] {
  const publishers: Publisher[] = [new GitPublisher(config)];
  if (config.confluence?.enabled) {
    publishers.push(new ConfluencePublisher(config.confluence));
  }
  return publishers;
}
