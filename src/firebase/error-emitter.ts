
'use client';
import { EventEmitter } from 'events';
import type { User } from 'firebase/auth';
import type { FirestorePermissionError } from './errors';

// A simple, client-side event emitter to broadcast Firestore permission errors
// to a central listener component without coupling the data-access code to the UI.

// Define the event signature
interface ErrorEmitterEvents {
  'permission-error': (error: FirestorePermissionError, user: User | null) => void;
}

declare interface TypedEventEmitter {
  on<E extends keyof ErrorEmitterEvents>(event: E, listener: ErrorEmitterEvents[E]): this;
  off<E extends keyof ErrorEmitterEvents>(event: E, listener: ErrorEmitterEvents[E]): this;
  emit<E extends keyof ErrorEmitterEvents>(event: E, ...args: Parameters<ErrorEmitterEvents[E]>): boolean;
}

class TypedEventEmitter extends EventEmitter {}

const emitter: TypedEventEmitter = new TypedEventEmitter();

export { emitter as errorEmitter };
