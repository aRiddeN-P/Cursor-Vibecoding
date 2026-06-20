import { friendlyApiError } from './errors.js';
import { showErrorModal } from '../components/modal.js';

export function showApiError(err, options = {}) {
  const message = friendlyApiError(err);
  return showErrorModal(message, options);
}
