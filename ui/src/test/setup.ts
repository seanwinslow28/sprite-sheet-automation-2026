/**
 * Vitest setup file for React Testing Library
 */

import '@testing-library/jest-dom';

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock scrollBy
Element.prototype.scrollBy = vi.fn();
