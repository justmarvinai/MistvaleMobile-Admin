import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

/**
 * jsdom is missing several browser APIs Mantine reaches for during layout. Stubbing them
 * here keeps every component test from having to know that.
 */

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
window.ResizeObserver = ResizeObserverStub;

// Mantine's Popover/Select measure with these; jsdom leaves them undefined.
window.HTMLElement.prototype.scrollIntoView = vi.fn();

/**
 * jsdom 26 has no `Blob.prototype.text`, which every browser has had since 2019 and the
 * snapshot panel reads a chosen file with. Implemented rather than stubbed — through
 * `FileReader`, which jsdom does have — so a test that reads a file reads the real bytes
 * and a mistake in the parsing shows up here rather than only in a browser.
 */
if (typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function text(this: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
      reader.readAsText(this);
    });
  };
}

afterEach(() => {
  cleanup();
});
