import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TabBar } from './TabBar';
import { usePlaceStore } from '../state/usePlaceStore';

describe('TabBar resume links', () => {
  beforeEach(() => {
    usePlaceStore.setState({
      lessons: { carmel: 4 },
      currentLessonId: 'carmel',
      routes: {},
      currentJourneyId: null,
      timeline: null,
      quizzes: {},
      currentQuizId: null,
    });
  });

  it('keeps Home at / while a lesson is saved', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <TabBar />
      </MemoryRouter>,
    );
    expect(container.querySelector('a[href="/"]')).not.toBeNull();
    expect(container.querySelector('a[href="/lessons/carmel"]')).not.toBeNull();
  });

  it('stays selected on the lesson list', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/lessons']}>
        <TabBar />
      </MemoryRouter>,
    );
    const link = container.querySelector('a[href="/lessons/carmel"]');
    expect(link?.className).toContain('tabbar__item--active');
  });

  it('exposes aria-current for the visible section, including the list', () => {
    const onList = render(
      <MemoryRouter initialEntries={['/lessons']}>
        <TabBar />
      </MemoryRouter>,
    );
    expect(onList.container.querySelector('a[href="/lessons/carmel"]')?.getAttribute('aria-current')).toBe(
      'page',
    );
    onList.unmount();

    const home = render(
      <MemoryRouter initialEntries={['/']}>
        <TabBar />
      </MemoryRouter>,
    );
    expect(home.container.querySelector('a[href="/"]')?.getAttribute('aria-current')).toBe('page');
    expect(home.container.querySelector('a[href="/lessons/carmel"]')?.getAttribute('aria-current')).toBeNull();
  });
});
