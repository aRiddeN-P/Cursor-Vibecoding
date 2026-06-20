const CHILD_KEY = 'lalayi_selected_child';

export function getSelectedChild() {
  const raw = localStorage.getItem(CHILD_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setSelectedChild(child) {
  localStorage.setItem(CHILD_KEY, JSON.stringify(child));
}

export function clearSelectedChild() {
  localStorage.removeItem(CHILD_KEY);
}

export function requireSelectedChild(navigate) {
  const child = getSelectedChild();
  if (!child) {
    navigate('/home');
    return null;
  }
  return child;
}
