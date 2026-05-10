import React, { useState } from 'react';
import { api } from '../../lib/api.js';

export function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');

  return (
    <Shell>
      <div className="auth-card">
        <h1>Chatfr</h1>
        <div className="mode-toggle">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Sign up</button>
        </div>

        {error ? <div className="error-text">{error}</div> : null}
        {mode === 'login' ? <LoginForm onSuccess={onAuth} setError={setError} /> : null}
        {mode === 'signup' ? <SignupForm onSuccess={onAuth} setError={setError} /> : null}
      </div>
    </Shell>
  );
}

export function SignupUserNumberNotice({ userNumber, onContinue }) {
  return (
    <div className="signup-notice-overlay" role="dialog" aria-modal="true">
      <div className="signup-notice-card">
        <h2>YOUR USER NUMBER IS</h2>
        <div className="signup-number-shell">
          <div className="signup-number-inner">{`#${userNumber}`}</div>
        </div>
        <p>Remember it. You need this user number to log in again.</p>
        <button className="primary" type="button" onClick={onContinue}>I saved it</button>
      </div>
    </div>
  );
}

function LoginForm({ onSuccess, setError }) {
  const [userNumber, setUserNumber] = useState('');
  const [password, setPassword] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: { userNumber, password }
      });

      onSuccess(data.token, data.user, { showUserNumberNotice: false });
    } catch (error) {
      setError(error.message);
    }
  };

  return <AuthForm submit={submit} fields={[{ label: 'User number', value: userNumber, setValue: setUserNumber, type: 'number' }, { label: 'Password', value: password, setValue: setPassword, type: 'password' }]} cta="Enter" />;
}

function SignupForm({ onSuccess, setError }) {
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      const data = await api('/api/auth/signup', {
        method: 'POST',
        body: { displayName, password }
      });

      onSuccess(data.token, data.user, { showUserNumberNotice: true });
    } catch (error) {
      setError(error.message);
    }
  };

  return <AuthForm submit={submit} fields={[{ label: 'Display name', value: displayName, setValue: setDisplayName, type: 'text' }, { label: 'Password', value: password, setValue: setPassword, type: 'password' }]} cta="Create account" />;
}

function AuthForm({ submit, fields, cta }) {
  return (
    <form className="stack" onSubmit={submit}>
      {fields.map((field) => (
        <label key={field.label} className="field">
          <span>{field.label}</span>
          <input value={field.value} onChange={(event) => field.setValue(event.target.value)} type={field.type} />
        </label>
      ))}
      <button className="primary" type="submit">{cta}</button>
    </form>
  );
}

function Shell({ children }) {
  return (
    <div className="shell">
      <div className="frame">{children}</div>
    </div>
  );
}