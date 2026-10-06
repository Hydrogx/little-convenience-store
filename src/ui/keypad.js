/**
 * 数字键盘。
 * 专为儿童手指设计的 3×4 大按钮，支持触摸、鼠标，也支持电脑键盘数字键。
 */
import { el } from './dom.js';
import { icon } from './icons.js';

export function createKeypad(ctx, { label, submitLabel, onSubmit, onChange, maxLength = 3 } = {}) {
  let value = '';

  const displayValue = el('span', { class: 'keypad__value', text: '–' });
  const display = el(
    'div',
    {
      class: 'keypad__display',
      attrs: { role: 'status', 'aria-live': 'polite', 'aria-label': label }
    },
    [displayValue]
  );

  const grid = el('div', { class: 'keypad__grid', role: 'group', attrs: { 'aria-label': label } });

  function updateDisplay() {
    displayValue.textContent = value === '' ? '–' : value;
    submitButton.disabled = value === '';
    display.classList.toggle('is-filled', value !== '');
  }

  function setValue(next) {
    value = String(next).replace(/[^0-9]/g, '').slice(0, maxLength);
    updateDisplay();
    if (typeof onChange === 'function') onChange(value);
  }

  function pressDigit(digit) {
    if (value === '0') value = '';
    setValue(value + digit);
  }

  for (const digit of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) {
    grid.appendChild(
      el('button', {
        class: 'keypad__key',
        type: 'button',
        text: digit,
        attrs: { 'aria-label': digit },
        on: { click: () => pressDigit(digit) }
      })
    );
  }
  grid.appendChild(
    el('button', {
      class: 'keypad__key keypad__key--action',
      type: 'button',
      attrs: { 'aria-label': ctx.t('checkout.backspace') },
      on: { click: () => setValue(value.slice(0, -1)) }
    }, [icon('back')])
  );
  grid.appendChild(
    el('button', {
      class: 'keypad__key',
      type: 'button',
      text: '0',
      attrs: { 'aria-label': '0' },
      on: { click: () => pressDigit('0') }
    })
  );
  grid.appendChild(
    el('button', {
      class: 'keypad__key keypad__key--action',
      type: 'button',
      attrs: { 'aria-label': ctx.t('checkout.clearInput') },
      on: { click: () => setValue('') }
    }, [icon('refresh')])
  );

  const submitButton = el('button', {
    class: 'button button--primary keypad__submit',
    type: 'button',
    disabled: true,
    on: {
      click: () => {
        if (value === '') return;
        if (typeof onSubmit === 'function') onSubmit(Number(value));
      }
    }
  }, [icon('check'), el('span', { class: 'button__label', text: submitLabel })]);

  const root = el('div', { class: 'keypad' }, [display, grid, submitButton]);
  updateDisplay();

  return {
    root,
    getValue: () => value,
    setValue,
    reset() {
      setValue('');
    },
    /** 电脑键盘：数字、退格、删除、回车。 */
    handleKey(key) {
      if (/^[0-9]$/.test(key)) {
        pressDigit(key);
        return true;
      }
      if (key === 'Backspace') {
        setValue(value.slice(0, -1));
        return true;
      }
      if (key === 'Delete') {
        setValue('');
        return true;
      }
      if (key === 'Enter') {
        if (value !== '' && typeof onSubmit === 'function') onSubmit(Number(value));
        return true;
      }
      return false;
    }
  };
}
