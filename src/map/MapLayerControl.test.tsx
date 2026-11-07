import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MapLayerControl } from './MapLayerControl';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}

const MAP_MODES = [
  'src/modes/sandbox/AtlasMode.tsx',
  'src/modes/map-trace/TraceMode.tsx',
  'src/modes/lesson/LessonMode.tsx',
  'src/modes/quiz/QuizMode.tsx',
];

describe('layer controls placement guard', () => {
  it('every map mode renders the shared floating MapLayerControl', () => {
    for (const f of MAP_MODES) expect(readFileSync(f, 'utf8'), f).toMatch(/<MapLayerControl\b/);
  });

  it('no mode renders LayerPanel or its own layer/toggle fieldset directly', () => {
    for (const f of sources('src/modes')) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/<LayerPanel\b/);
      expect(src, f).not.toMatch(/map-floating-layers/);
      // Timeline's lane filters reuse the class but are not map layers.
      if (!f.includes('timeline')) expect(src, f).not.toMatch(/className="atlas-toggles"/);
    }
  });
});

describe('MapLayerControl', () => {
  it('lists extra groups in the panel row style, counts them in the badge, and includes Oct 7 sites', () => {
    const onChange = vi.fn();
    render(
      <MapLayerControl
        extraGroups={[
          {
            title: 'Atlas content',
            items: [
              { id: 'a', label: 'Sites', checked: true, onChange },
              { id: 'b', label: 'Journey routes', checked: false, onChange },
            ],
          },
        ]}
      />,
    );
    const root = screen.getByTestId('map-layer-control');
    expect(root.className).toBe('map-floating-layers');
    const sites = screen.getByRole('checkbox', { name: 'Sites' });
    expect(sites.closest('label')?.className).toBe('atlas-toggles__checkbox-label');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Journey routes' }));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('checkbox', { name: /Oct 7, 2023 attack sites/ })).toBeInTheDocument();
    const geography = screen.getByRole('heading', { name: 'Geography & Features' }).parentElement!;
    const imagery = screen.getByRole('heading', { name: 'Imagery & Historical Maps' }).parentElement!;
    expect(geography.querySelector('input[type="checkbox"]')?.closest('label')?.textContent).toContain('Topography (terrain)');
    expect(imagery.textContent).not.toContain('Topography (terrain)');
    // 5 default basemap layers (topography, borders, rivers, lakes, grid) + Sites.
    expect(screen.getByText('6 active')).toBeInTheDocument();
  });
});
