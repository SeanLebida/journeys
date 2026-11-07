import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlaceFrame } from './PlaceFrame';

describe('PlaceFrame', () => {
  it('shows a relief close view and locator when the site has no photo and the network is off', () => {
    const { container } = render(
      <PlaceFrame siteId="site-no-such-photo" lat={31.78} lon={35.2} name="Jerusalem" online={false} />,
    );
    expect(container.querySelector('[data-place-frame="relief"]')).not.toBeNull();
    expect(container.querySelector('[data-place-locator]')).not.toBeNull();
    const html = document.documentElement.innerHTML;
    expect(html).not.toContain('arcgisonline');
    expect(html).not.toContain('satellite-raster');
  });

  it('uses the bundled photo and skips the relief frame when one exists', () => {
    const { container } = render(
      <PlaceFrame siteId="site-bethlehem" lat={31.7} lon={35.2} name="Bethlehem" online={false} />,
    );
    expect(container.querySelector('[data-place-frame="relief"]')).toBeNull();
  });
});
