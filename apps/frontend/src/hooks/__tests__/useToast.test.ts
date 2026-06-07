import { act } from '@testing-library/react';
import { useToastStore } from '../useToast';

beforeEach(() => {
  jest.useFakeTimers();
  act(() => useToastStore.setState({ toasts: [] }));
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('useToastStore', () => {
  it('adds a toast with message, severity and a generated id', () => {
    act(() => useToastStore.getState().addToast('hello', 'info'));

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ message: 'hello', severity: 'info' });
    expect(toasts[0].id).toMatch(/^toast-/);
  });

  it('auto-dismisses a toast after 4000ms', () => {
    act(() => useToastStore.getState().addToast('temp', 'warning'));
    expect(useToastStore.getState().toasts).toHaveLength(1);

    act(() => { jest.advanceTimersByTime(4000); });
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('removeToast removes only the matching toast', () => {
    act(() => {
      useToastStore.getState().addToast('a', 'info');
      useToastStore.getState().addToast('b', 'error');
    });
    const [first] = useToastStore.getState().toasts;

    act(() => useToastStore.getState().removeToast(first.id));

    const remaining = useToastStore.getState().toasts;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].message).toBe('b');
  });

  it('keeps the optional action on the toast', () => {
    const onClick = jest.fn();
    act(() => useToastStore.getState().addToast('with action', 'critical', { label: 'Undo', onClick }));

    expect(useToastStore.getState().toasts[0].action?.label).toBe('Undo');
  });
});
