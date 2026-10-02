import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tooltip } from '../Tooltip';

const content = { description: 'What h-index means', pros: 'Simple', cons: 'Field-dependent' };

function setup() {
  render(
    <div>
      <Tooltip content={content}><span>h-index card</span></Tooltip>
      <button>elsewhere</button>
    </div>
  );
  const trigger = screen.getByRole('button', { name: /h-index card/ });
  const tip = screen.getByRole('tooltip', { hidden: true });
  return { trigger, tip };
}

describe('Tooltip', () => {
  it('is described by its popover even while closed', () => {
    const { trigger, tip } = setup();
    expect(trigger).toHaveAttribute('aria-describedby', tip.id);
    expect(tip).not.toBeVisible();
  });

  it('opens on tap and closes on a second tap', () => {
    const { trigger, tip } = setup();
    fireEvent.pointerDown(trigger, { pointerType: 'touch' });
    fireEvent.focus(trigger);
    fireEvent.click(trigger);
    expect(tip).toBeVisible();
    fireEvent.pointerDown(trigger, { pointerType: 'touch' });
    fireEvent.click(trigger);
    expect(tip).not.toBeVisible();
  });

  it('opens on keyboard focus and closes on Escape', () => {
    const { trigger, tip } = setup();
    fireEvent.focus(trigger);
    expect(tip).toBeVisible();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(tip).not.toBeVisible();
  });

  it('closes on a tap outside', () => {
    const { trigger, tip } = setup();
    fireEvent.click(trigger);
    expect(tip).toBeVisible();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'elsewhere' }));
    expect(tip).not.toBeVisible();
  });
});
