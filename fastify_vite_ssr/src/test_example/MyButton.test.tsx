import { render, screen, fireEvent } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { MyButton } from './MyButton';

test('it calls onClick when clicked', () => {
  const handleClick = vi.fn(); // Create a "spy" function
  render(<MyButton label="Click Me" onClick={handleClick} />);

  // Find the button by its text (just like a user would)
  const button = screen.getByText(/click me/i);
  fireEvent.click(button);

  expect(handleClick).toHaveBeenCalledTimes(1);
});
