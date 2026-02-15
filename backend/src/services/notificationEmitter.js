import { EventEmitter } from 'events';

const notificationEmitter = new EventEmitter();
notificationEmitter.setMaxListeners(0); // No limit — one listener per SSE connection

export default notificationEmitter;
