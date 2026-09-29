import * as THREE from 'three';

export function createCricketRenderer(canvas, loading) {
  const showFailure = (message) => {
    loading.hidden = false;
    loading.classList.add('is-error');
    loading.querySelector('strong').textContent = 'UNAVAILABLE';
    loading.querySelector('span').textContent = message;
    if (!loading.querySelector('button')) {
      const retry = document.createElement('button');
      retry.textContent = 'RETRY';
      retry.addEventListener('click', () => window.location.reload());
      const home = document.createElement('a');
      home.href = '/';
      home.textContent = 'BACK TO HOME';
      loading.append(retry, home);
    }
  };
  try {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    canvas.addEventListener('webglcontextlost', () => {
      showFailure('The 3D display was interrupted. Retry to restart the game.');
    });
    return renderer;
  } catch (error) {
    showFailure('3D graphics could not start in this browser. Try another browser or retry.');
    throw error;
  }
}
