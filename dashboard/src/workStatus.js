const FALLBACK_WIDGET = { text: '\uF1BE', color: '#ff0000' };

/**
 * Resolve a work-host status to the icon widget overrides used by the layout.
 * Unknown values intentionally keep the existing static icon unchanged.
 *
 * @param {string} status
 * @returns {{text: string, color: string}}
 */
export function statusToWidget(status) {
  if (status === 'reachable') {
    return { text: '\uF17D', color: '#ff0000' };
  }
  if (status === 'unreachable') {
    return { text: '\uF22F', color: '#000000' };
  }
  return { ...FALLBACK_WIDGET };
}
