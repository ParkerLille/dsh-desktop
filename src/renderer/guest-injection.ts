import type { DesktopPluginRecord } from '../shared/contracts'

export function buildPluginInjection(records: readonly DesktopPluginRecord[]): string {
  const enabled = records.filter(record => record.manifest.enabled)
  const activations = enabled.map(record => `
  try {
    {
      const api = createApi(${JSON.stringify(record.manifest.id)});
      ${record.source}
    }
  } catch (error) {
    errors.push({ id: ${JSON.stringify(record.manifest.id)}, error: error instanceof Error ? error.message : String(error) });
  }`).join('\n')
  return `(() => {
  window.__DSH_DESKTOP_PLUGIN_DISPOSE__?.();
  const owned = [];
  const errors = [];
  let root = null;
  const ensureRoot = () => {
    if (root?.isConnected) return root;
    root = document.createElement('aside');
    root.dataset.dshDesktopRuntime = 'true';
    root.setAttribute('aria-label', 'Desktop plugins');
    root.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483000;display:grid;gap:8px;max-width:360px';
    document.body.append(root);
    owned.push(root);
    return root;
  };
  const createApi = pluginId => ({
    registerPanel(panel) {
      const section = document.createElement('section');
      section.dataset.dshDesktopPlugin = pluginId;
      section.dataset.panelId = panel.id;
      section.style.cssText = 'background:var(--color-background,#fff);color:var(--color-foreground,#171717);border:1px solid rgba(127,127,127,.35);border-radius:6px;padding:12px;box-shadow:0 8px 24px rgba(0,0,0,.16)';
      const heading = document.createElement('strong');
      heading.textContent = panel.title;
      const content = document.createElement('div');
      content.innerHTML = panel.html;
      section.append(heading, content);
      ensureRoot().append(section);
    },
    registerStyle(css) {
      const style = document.createElement('style');
      style.dataset.dshDesktopPlugin = pluginId;
      style.textContent = css;
      document.head.append(style);
      owned.push(style);
    },
    registerCommand(command) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.dshDesktopPlugin = pluginId;
      button.dataset.commandId = command.id;
      button.textContent = command.label;
      button.addEventListener('click', command.run);
      ensureRoot().append(button);
    },
    notify(message) {
      const status = document.createElement('div');
      status.dataset.dshDesktopPlugin = pluginId;
      status.setAttribute('role', 'status');
      status.textContent = message;
      ensureRoot().append(status);
    },
  });
  ${activations}
  window.__DSH_DESKTOP_PLUGIN_DISPOSE__ = () => {
    for (const node of owned.reverse()) node.remove();
    document.querySelectorAll('[data-dsh-desktop-plugin]').forEach(node => node.remove());
    delete window.__DSH_DESKTOP_PLUGIN_DISPOSE__;
  };
  return errors;
})()`
}
