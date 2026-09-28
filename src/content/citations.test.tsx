import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClaimMeta, ReviewBadge } from './citations';

describe('review honesty', () => {
  it('labels self-reviewed claims as such, not as approved', () => {
    render(<ReviewBadge status="self-reviewed" />);
    expect(screen.getByText('Not specialist-signed')).toBeInTheDocument();
    expect(screen.queryByText('Specialist-signed')).not.toBeInTheDocument();
    expect(screen.queryByText('Scholar-approved')).not.toBeInTheDocument();
  });

  it('pairs confidence with review status', () => {
    render(<ClaimMeta confidence="high" reviewStatus="self-reviewed" />);
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('Not specialist-signed')).toBeInTheDocument();
    expect(screen.getByText('Checked by the project, not yet signed off by a specialist')).toBeInTheDocument();
  });
});
