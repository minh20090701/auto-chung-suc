import { handleRequest } from '../lib/chungsuc.js';
// Vercel Node.js runtime supports the Web Standard fetch handler.
export default {
  fetch(request) {
    return handleRequest({request, env: process.env});
  }
};
