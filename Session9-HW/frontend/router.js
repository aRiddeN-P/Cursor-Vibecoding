import { isLoggedIn } from './utils/auth.js';
import { getSelectedChild } from './utils/child.js';
import { getChildren } from './api/children.js';
import { renderLogin } from './screens/login.js';
import { renderAddChild } from './screens/add-child.js';
import { renderHome } from './screens/home.js';
import { renderSelectChild } from './screens/select-child.js';
import { renderModePicker } from './screens/mode-picker.js';
import { renderCalmStory } from './screens/calm-story.js';
import { renderParentStoryForm } from './screens/parent-story-form.js';
import { renderCalmPlayback } from './screens/calm-playback.js';
import { renderSettings } from './screens/settings.js';
import { renderInteractiveStory } from './screens/interactive-story.js';

function parseRoute() {
  const raw = window.location.hash.slice(1) || '/login';
  const [pathPart, queryPart] = raw.split('?');
  const params = new URLSearchParams(queryPart || '');
  const from = params.get('from');

  if (pathPart.startsWith('/calm/play/')) {
    const storyId = Number(pathPart.split('/').pop());
    return { path: '/calm/play', storyId, calmTab: null, from };
  }

  if (pathPart === '/calm/mine') {
    return { path: '/calm', calmTab: 'mine', storyId: null, from };
  }

  if (pathPart === '/calm/write') {
    return { path: '/calm/write', calmTab: null, storyId: null, from };
  }

  const known = [
    '/login',
    '/add-child',
    '/home',
    '/select-child',
    '/mode',
    '/choose-mode',
    '/calm',
    '/settings',
    '/voice-settings',
    '/interactive',
  ];

  return {
    path: known.includes(pathPart) ? pathPart : '/login',
    storyId: null,
    calmTab: null,
    from,
  };
}

function navigate(path) {
  window.location.hash = path;
}

function navigateToHome() {
  if (getSelectedChild()) {
    navigate('/mode');
  } else {
    navigate('/home');
  }
}

function tabHandlers() {
  return {
    onHome: navigateToHome,
    onSettings: () => navigate('/settings'),
  };
}

function requireChildOrHome() {
  if (!getSelectedChild()) {
    navigate('/select-child');
    return false;
  }
  return true;
}

export function startRouter(container) {
  let settingsCleanup = null;

  function render() {
    settingsCleanup?.();
    settingsCleanup = null;

    const { path, storyId, calmTab, from } = parseRoute();
    container.innerHTML = '';

    if (!isLoggedIn() && path !== '/login') {
      navigate('/login');
      return;
    }

    if (isLoggedIn() && path === '/login') {
      navigate('/home');
      return;
    }

    if (path === '/choose-mode') {
      navigate('/mode');
      return;
    }

    if (path === '/voice-settings') {
      navigate('/settings');
      return;
    }

    const tabs = tabHandlers();

    switch (path) {
      case '/login':
        renderLogin(container, {
          onSuccess(isNewUser) {
            navigate(isNewUser ? '/add-child' : '/home');
          },
        });
        break;

      case '/add-child':
        renderAddChild(container, {
          onContinue() {
            navigate(from === 'settings' ? '/settings' : '/home');
          },
          onBack() {
            if (from === 'settings') {
              navigate('/settings');
              return;
            }
            navigate(getSelectedChild() ? '/home' : '/select-child');
          },
        });
        break;

      case '/home':
        renderHome(container, {
          ...tabs,
          onSelectMode() {
            if (!requireChildOrHome()) return;
            navigate('/mode');
          },
          onChangeChild() {
            navigate('/select-child');
          },
          onAddChild() {
            navigate('/add-child');
          },
        });
        break;

      case '/select-child':
        renderSelectChild(container, {
          onChildSelected() {
            navigate('/mode');
          },
          onBack() {
            navigate('/home');
          },
          onAddChild() {
            navigate('/add-child');
          },
        });
        break;

      case '/mode':
        if (!requireChildOrHome()) return;
        renderModePicker(container, {
          ...tabs,
          onCalm() {
            navigate('/calm');
          },
          onInteractive() {
            navigate('/interactive');
          },
          onChangeChild() {
            navigate('/select-child');
          },
          onBack() {
            getChildren()
              .then(({ children }) => {
                if (children.length <= 1) {
                  navigate('/home');
                } else {
                  navigate('/select-child');
                }
              })
              .catch(() => navigate('/select-child'));
          },
        });
        break;

      case '/settings':
        settingsCleanup = renderSettings(container, {
          ...tabs,
          onAddChild() {
            navigate('/add-child?from=settings');
          },
          onLogout() {
            navigate('/login');
          },
        });
        break;

      case '/interactive':
        if (!requireChildOrHome()) return;
        renderInteractiveStory(container, {
          ...tabs,
          onBack() {
            navigate('/mode');
          },
        });
        break;

      case '/calm':
        if (!requireChildOrHome()) return;
        renderCalmStory(container, {
          ...tabs,
          initialTab: calmTab || 'library',
          onSelectStory(id) {
            navigate(`/calm/play/${id}`);
          },
          onWriteStory() {
            navigate('/calm/write');
          },
          onBack() {
            navigate('/mode');
          },
        });
        break;

      case '/calm/write':
        if (!requireChildOrHome()) return;
        renderParentStoryForm(container, {
          onSuccess() {
            navigate('/calm/mine');
          },
          onCancel() {
            navigate('/calm');
          },
        });
        break;

      case '/calm/play':
        if (!storyId) {
          navigate('/calm');
          return;
        }
        if (!requireChildOrHome()) return;
        renderCalmPlayback(container, {
          storyId,
          onBack() {
            navigate('/calm');
          },
        });
        break;

      default:
        navigate('/login');
    }
  }

  window.addEventListener('hashchange', render);
  render();
}
