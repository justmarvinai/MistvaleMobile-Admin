import { useState, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { EffectComponent } from '@/api/types';
import { EffectComponentEditor } from './EffectComponentEditor';
import { serializeComponents } from '@/features/skills/components';
import { renderWithProviders } from '@/test/render';

/**
 * The composer's UI contract: add, remove and reorder actually change the list the
 * editor would serialize, and the fields rendered belong to the selected component type.
 */

const STATUS_OPTIONS = [
  { value: 'poison', label: 'Poison · poison' },
  { value: 'atk_up', label: 'Attack Up · atk_up' },
];

/** Drives the editor as the composer does, and exposes what would be saved. */
function Harness({ initial }: { initial: EffectComponent[] }): ReactNode {
  const [components, setComponents] = useState(initial);
  return (
    <>
      <EffectComponentEditor
        components={components}
        onChange={setComponents}
        statusOptions={STATUS_OPTIONS}
        issues={[]}
      />
      <pre data-testid="payload">{JSON.stringify(serializeComponents(components))}</pre>
    </>
  );
}

function payload(): unknown {
  return JSON.parse(screen.getByTestId('payload').textContent ?? '[]');
}

const damage: EffectComponent = { type: 'damage', scale: 'atk', mult: 3.2, hits: 2 };
const poison: EffectComponent = {
  type: 'applyStatus',
  status: 'poison',
  turns: 2,
  target: 'hitTargets',
};
const heal: EffectComponent = { type: 'heal', scale: 'maxHp', mult: 0.2, target: 'self' };

describe('EffectComponentEditor', () => {
  it('renders one card per component with a type picker', () => {
    renderWithProviders(<Harness initial={[damage, poison]} />);

    expect(screen.getByTestId('component-0')).toBeInTheDocument();
    expect(screen.getByTestId('component-1')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Component 1 type' })).toHaveValue('Damage');
    expect(screen.getByRole('textbox', { name: 'Component 2 type' })).toHaveValue('Apply status');
  });

  it('shows the empty state and blocks nothing when there are no components', () => {
    renderWithProviders(<Harness initial={[]} />);
    expect(screen.getByText(/A skill with no components does nothing/)).toBeInTheDocument();
    expect(payload()).toEqual([]);
  });

  it('adds a component of the chosen type to the end of the list', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness initial={[damage]} />);

    await user.click(screen.getByRole('button', { name: /add component/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Heal' }));

    expect(payload()).toEqual([
      { type: 'damage', scale: 'atk', mult: 3.2, hits: 2 },
      { type: 'heal', scale: 'maxHp', mult: 0.15, target: 'self' },
    ]);
  });

  it('removes the component whose delete button was pressed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness initial={[damage, poison, heal]} />);

    await user.click(screen.getByLabelText('Remove component 2'));

    const result = payload();
    expect(Array.isArray(result) && result).toHaveLength(2);
    expect(result).toEqual([
      { type: 'damage', scale: 'atk', mult: 3.2, hits: 2 },
      { type: 'heal', scale: 'maxHp', mult: 0.2, target: 'self' },
    ]);
  });

  it('reorders components with the move buttons', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness initial={[damage, poison, heal]} />);

    await user.click(screen.getByLabelText('Move component 3 up'));

    expect(payload()).toEqual([
      { type: 'damage', scale: 'atk', mult: 3.2, hits: 2 },
      { type: 'heal', scale: 'maxHp', mult: 0.2, target: 'self' },
      { type: 'applyStatus', status: 'poison', turns: 2, target: 'hitTargets' },
    ]);
  });

  it('disables the move buttons at the ends of the list', () => {
    renderWithProviders(<Harness initial={[damage, poison]} />);

    expect(screen.getByLabelText('Move component 1 up')).toBeDisabled();
    expect(screen.getByLabelText('Move component 2 down')).toBeDisabled();
    expect(screen.getByLabelText('Move component 1 down')).toBeEnabled();
  });

  it('renders the fields belonging to the selected type, and only those', () => {
    renderWithProviders(<Harness initial={[damage]} />);
    const card = within(screen.getByTestId('component-0'));

    // Damage-specific.
    expect(card.getByRole('textbox', { name: 'Multiplier' })).toBeInTheDocument();
    expect(card.getByRole('textbox', { name: 'Hits' })).toBeInTheDocument();
    // Belongs to applyStatus, not damage.
    expect(card.queryByRole('textbox', { name: 'Turns' })).not.toBeInTheDocument();
  });

  it('swaps the field set when a component is retyped, keeping shared values', async () => {
    const user = userEvent.setup();
    const gated: EffectComponent = { ...damage, chance: 0.5 };
    renderWithProviders(<Harness initial={[gated]} />);

    await user.click(screen.getByRole('textbox', { name: 'Component 1 type' }));
    await user.click(await screen.findByRole('option', { name: 'Shield' }));

    const result = payload();
    expect(result).toEqual([
      { type: 'shield', scale: 'maxHp', mult: 0.15, turns: 2, target: 'self', chance: 0.5 },
    ]);
    // The damage-only field is gone from the DOM as well as from the payload.
    expect(screen.queryByRole('textbox', { name: 'Hits' })).not.toBeInTheDocument();
  });

  it('writes a chosen status key into the payload', async () => {
    const user = userEvent.setup();
    const blank: EffectComponent = {
      type: 'applyStatus',
      status: '',
      turns: 2,
      target: 'hitTargets',
    };
    renderWithProviders(<Harness initial={[blank]} />);

    await user.click(screen.getByRole('textbox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'Attack Up · atk_up' }));

    expect(payload()).toEqual([
      { type: 'applyStatus', status: 'atk_up', turns: 2, target: 'hitTargets' },
    ]);
  });

  it('offers only real status keys, never free text', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness initial={[poison]} />);

    await user.click(screen.getByRole('textbox', { name: 'Status' }));

    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Poison · poison',
      'Attack Up · atk_up',
    ]);
  });

  it('marks a component that carries a blocking issue', () => {
    renderWithProviders(
      <EffectComponentEditor
        components={[poison]}
        onChange={() => {}}
        statusOptions={STATUS_OPTIONS}
        issues={[{ severity: 'error', index: 0, message: 'No such status effect exists.' }]}
      />,
    );

    expect(screen.getByText('No such status effect exists.')).toBeInTheDocument();
  });
});
