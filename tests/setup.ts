import '@testing-library/jest-dom/vitest';
import '../src/i18n';

if (typeof window !== 'undefined' && !window.URL.createObjectURL) {
  window.URL.createObjectURL = () => 'blob:mock';
}

