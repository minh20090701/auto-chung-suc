import {handle} from '../lib/shop.js';
export default {fetch(request){return handle(request,process.env)}};
