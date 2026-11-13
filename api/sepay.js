import {webhook} from '../lib/shop.js';
export default {fetch(request){return webhook(request,process.env)}};
