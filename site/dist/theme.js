// Apply the saved preference before first paint; storage can be unavailable.
try {
  document.documentElement.dataset.theme = localStorage.getItem('bvol-theme') === 'light' ? 'light' : 'dark';
} catch {
  document.documentElement.dataset.theme = 'dark';
}
