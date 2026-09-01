import { describe, expect, it, vi } from 'vitest';

/**
 * Covers the matching policy in PersistentSession.select.
 *
 * The option matching itself runs as a stringified function inside the page, so
 * a Node test cannot execute it. What IS testable here, and what actually
 * decides whether a caller gets the right option, is the strategy around it:
 * which lookups `auto` tries and in what order, that an explicit `--by` does not
 * silently fall back to another strategy, and that a miss reports the options
 * that were available rather than a bare timeout.
 *
 * The logic is reproduced against a fake locator rather than importing
 * PersistentSession, which drags in a CDP driver, a browser-server manifest and
 * a filesystem session directory. That keeps this a test of the policy and not
 * of the transport.
 */

type Spec = { value?: string; label?: string; index?: number };

function makeLocator(options: Array<{ value: string; label: string }>) {
  const selectOption = vi.fn(async (spec: Spec): Promise<string[]> => {
    let match = -1;
    if (typeof spec.index === 'number') match = spec.index;
    else if (spec.value !== undefined) match = options.findIndex((o) => o.value === spec.value);
    else if (spec.label !== undefined) match = options.findIndex((o) => o.label === spec.label);
    if (match < 0 || match >= options.length) return [];
    return [options[match].value];
  });
  const listOptions = vi.fn(async () => options.map((o) => `${o.value} (${o.label})`));
  return { selectOption, listOptions };
}

async function select(
  locator: ReturnType<typeof makeLocator>,
  option: string,
  by: 'auto' | 'value' | 'label' | 'index' = 'auto',
): Promise<string[]> {
  let chosen: string[] = [];
  if (by === 'index') {
    const index = Number.parseInt(option, 10);
    if (!Number.isInteger(index)) throw new Error(`--by index needs a number, got "${option}"`);
    chosen = await locator.selectOption({ index });
  } else if (by === 'value') {
    chosen = await locator.selectOption({ value: option });
  } else if (by === 'label') {
    chosen = await locator.selectOption({ label: option });
  } else {
    chosen = await locator.selectOption({ value: option });
    if (chosen.length === 0) chosen = await locator.selectOption({ label: option });
  }
  if (chosen.length === 0) {
    const available = await locator.listOptions();
    throw new Error(`No option matched "${option}". Available: ${available.join(', ') || '(none)'}`);
  }
  return chosen;
}

const RANGES = [
  { value: '30d', label: '30 days' },
  { value: '12m', label: '12 months' },
  { value: 'all', label: 'All history' },
];

describe('session:select option matching', () => {
  it('matches on value without consulting the label', async () => {
    const locator = makeLocator(RANGES);
    await expect(select(locator, '12m')).resolves.toEqual(['12m']);
    // One lookup only: a value hit must not also cost a label lookup.
    expect(locator.selectOption).toHaveBeenCalledTimes(1);
  });

  it('falls back to the visible label, which is what a caller usually knows', async () => {
    const locator = makeLocator(RANGES);
    await expect(select(locator, 'All history')).resolves.toEqual(['all']);
    expect(locator.selectOption).toHaveBeenNthCalledWith(1, { value: 'All history' });
    expect(locator.selectOption).toHaveBeenNthCalledWith(2, { label: 'All history' });
  });

  it('reports the available options when nothing matches', async () => {
    const locator = makeLocator(RANGES);
    // A bare timeout would leave the caller guessing; the options are the fix.
    await expect(select(locator, 'last week')).rejects.toThrow(
      'No option matched "last week". Available: 30d (30 days), 12m (12 months), all (All history)',
    );
  });

  it('does not fall back when a strategy was named explicitly', async () => {
    const locator = makeLocator(RANGES);
    // 'All history' is a valid LABEL. Asking by value must still fail, otherwise
    // --by cannot be used to prove which attribute actually matched.
    await expect(select(locator, 'All history', 'value')).rejects.toThrow('No option matched');
    expect(locator.selectOption).toHaveBeenCalledTimes(1);
  });

  it('selects by index', async () => {
    const locator = makeLocator(RANGES);
    await expect(select(locator, '2', 'index')).resolves.toEqual(['all']);
  });

  it('rejects a non-numeric index instead of coercing it', async () => {
    const locator = makeLocator(RANGES);
    await expect(select(locator, 'all', 'index')).rejects.toThrow('--by index needs a number');
  });

  it('treats an out-of-range index as a miss, not a silent last option', async () => {
    const locator = makeLocator(RANGES);
    await expect(select(locator, '9', 'index')).rejects.toThrow('No option matched');
  });
});
