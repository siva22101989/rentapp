<<<<<<< HEAD
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
  emit<E extends keyof ErrorEmitterEvents>(event: E, ...args: Parameters<ErrorEmitterEvents[E]>): boolean;
}

class TypedEventEmitter extends EventEmitter {}

const emitter: TypedEventEmitter = new TypedEventEmitter();

export { emitter as errorEmitter };
=======

import { EventEmitter } from 'events';
import { FirestorePermissionError } from './errors';

type ErrorEvents = {
  'permission-error': (error: FirestorePermissionError) => void;
};

// We need to declare the `emit` method with the specific event types
declare interface ErrorEventEmitter {
  on<E extends keyof ErrorEvents>(event: E, listener: ErrorEvents[E]): this;
  off<E extends keyof ErrorEvents>(event: E, listener: ErrorEvents[E]): this;
  emit<E extends keyof ErrorEvents>(event: E, ...args: Parameters<ErrorEvents[E]>): boolean;
}

class ErrorEventEmitter extends EventEmitter {}

export const errorEmitter = new ErrorEventEmitter();
>>>>>>> 493f64cf071699c798704dd512006dc35618f02c
