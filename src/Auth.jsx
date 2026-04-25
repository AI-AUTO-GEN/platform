import React, { useState } from 'react';
import { supabase } from './supabase';

export default function Auth({ session }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  if (session) return null;

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    let error;
    if (isLogin) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      error = signInError;
    } else {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      error = signUpError;
      if (!error) {
        alert("Registration successful! You log in automatically.");
      }
    }

    if (error) {
      alert(error.error_description || error.message);
    }
    setLoading(false);
  };

  return (
    <div className="auth-overlay glass slide-in">
      <div className="auth-card">
        <h1 className="brand-title"><span className="gradient-text">◈</span> RENDERFARM</h1>
        <p className="auth-subtitle">{isLogin ? 'Sign in to access your productions' : 'Create a new account'}</p>
        <form onSubmit={handleAuth} className="auth-form">
          <input 
            type="email" 
            className="input-field" 
            placeholder="Email Address" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input 
            type="password" 
            className="input-field" 
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>
        <button className="switch-mode-btn" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
        </button>
      </div>
    </div>
  );
}
