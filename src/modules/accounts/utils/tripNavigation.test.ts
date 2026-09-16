import assert from 'node:assert/strict';
import test from 'node:test';
import { getTripNavigationIndex as move } from './tripNavigation';

test('up/down select the adjacent trip, matching left/right', () => {
  assert.equal(move('ArrowDown', 2, 5), 3);
  assert.equal(move('ArrowUp', 2, 5), 1);
  assert.equal(move('ArrowRight', 2, 5), 3);
  assert.equal(move('ArrowLeft', 2, 5), 1);
});
test('navigation stays within bounds, including a single trip', () => {
  assert.equal(move('ArrowUp', 0, 5), 0);
  assert.equal(move('ArrowDown', 4, 5), 4);
  for (const key of ['ArrowUp', 'ArrowDown', 'Home', 'End']) assert.equal(move(key, 0, 1), 0);
});
test('Home/End select first/last and unsupported keys do nothing', () => {
  assert.equal(move('Home', 2, 5), 0);
  assert.equal(move('End', 2, 5), 4);
  for (const key of ['Tab', 'Escape', 'Enter', ' ']) assert.equal(move(key, 2, 5), null);
});
test('empty and changed lists are safe', () => {
  assert.equal(move('ArrowDown', 0, 0), null);
  assert.equal(move('ArrowUp', 8, 3), 1);
  assert.equal(move('ArrowDown', -1, 3), 1);
});
