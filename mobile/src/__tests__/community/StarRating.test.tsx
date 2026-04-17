import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StarRating } from '@/components/community/StarRating';

describe('StarRating', () => {
  it('renders 5 stars', () => {
    const { getAllByText } = render(<StarRating value={0} onChange={jest.fn()} />);
    expect(getAllByText('★')).toHaveLength(5);
  });

  it('calls onChange with the tapped star number', () => {
    const onChange = jest.fn();
    const { getAllByText, getByTestId } = render(<StarRating value={0} onChange={onChange} />);
    const stars = getAllByText('★');
    fireEvent.press(stars[2]);
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('calls onChange with 4 when 4th star tapped', () => {
    const onChange = jest.fn();
    const { getAllByText } = render(<StarRating value={2} onChange={onChange} />);
    const stars = getAllByText('★');
    fireEvent.press(stars[3]);
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
