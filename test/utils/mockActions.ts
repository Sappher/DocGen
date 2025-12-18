import * as core from '@actions/core';
import { vi } from 'vitest';

export function mockCoreInputs(inputs: Record<string, string>): void {
  vi.spyOn(core, 'getInput').mockImplementation((name: string) => inputs[name] ?? '');
  vi.spyOn(core, 'getMultilineInput').mockImplementation((name: string) => {
    const raw = inputs[name];
    if (!raw) {
      return [];
    }
    return raw.split(/\r?\n/);
  });
  vi.spyOn(core, 'warning').mockImplementation(() => undefined);
  vi.spyOn(core, 'info').mockImplementation(() => undefined);
  vi.spyOn(core, 'setFailed').mockImplementation(() => undefined);
}

export function restoreCoreMocks(): void {
  vi.restoreAllMocks();
}
