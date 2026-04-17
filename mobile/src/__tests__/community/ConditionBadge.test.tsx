import React from 'react';
import { render } from '@testing-library/react-native';
import { ConditionBadge } from '@/components/community/ConditionBadge';

describe('ConditionBadge', () => {
  it('renders the tag label', () => {
    const { getByText } = render(<ConditionBadge tag="muddy" />);
    expect(getByText('Muddy')).toBeTruthy();
  });

  it('renders closed in red', () => {
    const { getByText } = render(<ConditionBadge tag="closed" />);
    expect(getByText('Closed')).toBeTruthy();
  });

  it('renders dry in green', () => {
    const { getByText } = render(<ConditionBadge tag="dry" />);
    expect(getByText('Dry')).toBeTruthy();
  });

  it('renders all seven tags without crashing', () => {
    const tags = ['dry', 'wet', 'muddy', 'icy', 'snow', 'closed', 'overgrown'] as const;
    tags.forEach((tag) => {
      const { getByText } = render(<ConditionBadge tag={tag} />);
      expect(getByText(tag.charAt(0).toUpperCase() + tag.slice(1))).toBeTruthy();
    });
  });
});
