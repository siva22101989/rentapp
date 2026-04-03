
'use client';

// Defines the shape of the context for a Firestore security rule violation.
export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

// A custom error to be thrown when a Firestore operation fails due to security rules.
// It captures the context of the failed operation.
export class FirestorePermissionError extends Error {
  public readonly context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    // The main message is less important than the structured context.
    const message = `Firestore permission error during '${context.operation}' on path '${context.path}'.`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;
    
    // This is to make the error object serializable for the dev overlay
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
