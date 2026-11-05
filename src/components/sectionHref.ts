export function sectionHref(section: 'lessons' | 'trace' | 'quiz', currentId: string | null): string {
  const root = section === 'lessons' ? '/lessons' : section === 'trace' ? '/trace' : '/quiz';
  return currentId ? `${root}/${currentId}` : root;
}

export function tabSelected(sectionRoot: string, pathname: string, end: boolean): boolean {
  if (end || sectionRoot === '/') return pathname === sectionRoot;
  return pathname === sectionRoot || pathname.startsWith(`${sectionRoot}/`);
}
