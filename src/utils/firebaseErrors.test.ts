import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatFirebaseAuthErrorFr,
  isFirestoreOfflineError,
  isFirestorePermissionError,
} from './firebaseErrors';

test('isFirestoreOfflineError detects standard client offline and timeout errors', () => {
  assert.equal(
    isFirestoreOfflineError(new Error('Failed to get document because the client is offline.')),
    true
  );
  assert.equal(
    isFirestoreOfflineError(
      new Error('Could not reach Cloud Firestore backend. Backend didn\'t respond within 10 seconds.')
    ),
    true
  );
  assert.equal(isFirestoreOfflineError({ code: 'unavailable', message: 'Service unavailable' }), true);
  assert.equal(
    isFirestoreOfflineError({ code: 'auth/network-request-failed', message: 'Network error' }),
    true
  );
  assert.equal(
    isFirestoreOfflineError({ code: 'permission-denied', message: 'Missing or insufficient permissions.' }),
    false
  );
});

test('isFirestorePermissionError detects permission-denied separately from offline errors', () => {
  assert.equal(
    isFirestorePermissionError({
      code: 'permission-denied',
      message: 'Missing or insufficient permissions.',
    }),
    true
  );
  assert.equal(
    isFirestorePermissionError(new Error('Failed to get document because the client is offline.')),
    false
  );
});

test('formatFirebaseAuthErrorFr maps auth and offline errors to actionable French messages', () => {
  assert.match(
    formatFirebaseAuthErrorFr(new Error('Failed to get document because the client is offline.')),
    /Cloud Firestore/i
  );
  assert.match(
    formatFirebaseAuthErrorFr({ code: 'auth/invalid-credential', message: 'invalid-credential' }),
    /Identifiants incorrects/i
  );
  assert.match(
    formatFirebaseAuthErrorFr({ code: 'auth/too-many-requests', message: 'too-many-requests' }),
    /Trop de tentatives/i
  );
});
