// Input: keys held down, keys pressed since they were last cleared (hit), and a mouse click counts as attack (J).
export const keys = {}, pressed = {};
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); if (!keys[k]) pressed[k] = true; keys[k] = true;
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('mousedown', () => { pressed.j = true; });
export const hit = k => k.some(x => pressed[x]);
export const clearPressed = () => { for (const k in pressed) delete pressed[k]; };
