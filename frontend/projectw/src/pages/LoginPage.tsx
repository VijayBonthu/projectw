import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // Check for token in URL parameters (for OAuth redirect)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    
    if (token) {
      // Save the token and redirect to dashboard
      localStorage.setItem('token', token);
      navigate('/dashboard');
    }
  }, [location, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await axios.post(`${API_URL}/login`, {  
        email_address: email, 
        password: password
      });
      
      const { access_token } = response.data;
      localStorage.setItem('regular_token', access_token);
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid email or password');
      console.error('Login error:', err);
    }
  };



const handleGoogleLogin = () => {
  // Open the Google auth in a popup window instead of redirecting
  const authWindow = window.open(
    `${API_URL}/auth/login`,
    'GoogleAuth',
    'width=800,height=600,left=200,top=100'
  );
  
  if (!authWindow) {
    setError('Popup blocked! Please allow popups for this site.');
    return;
  }
  
  // Set up listener to receive the token from the popup
  const handleAuthCallback = (event: MessageEvent) => {
    console.log("Received message:", event.data);
    
    // Check for the auth success message
    if (event.data && event.data.type === 'google_auth_success' && event.data.access_token) {
      console.log("Authentication successful, token received");
      
      // Get the token
      const token = event.data.access_token;
      
      // Store token in localStorage
      localStorage.setItem('google_auth_token', token);
      
      // Close the popup
      if (authWindow && !authWindow.closed) {
        authWindow.close();
      }
      
      // Navigate to dashboard
      navigate('/dashboard');
      
      // Remove the event listener
      window.removeEventListener('message', handleAuthCallback);
    }
  };
  
  // Add the message event listener
  window.addEventListener('message', handleAuthCallback);
  
  // Cleanup if window closes without completing auth
  const checkClosed = setInterval(() => {
    if (authWindow && authWindow.closed) {
      clearInterval(checkClosed);
      window.removeEventListener('message', handleAuthCallback);
    }
  }, 1000);
};

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-primary-dark to-primary-light">
      <div className="max-w-md w-full p-8 bg-black rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center text-white">Sign In</h1>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-white mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-white mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md"
          >
            Sign In
          </button>
          <button 
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <svg aria-hidden="true" viewBox="0 0 18 18" className='h-5 w-5 mr-2'> 
              <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"></path> 
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"></path> 
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"></path> 
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"></path> 
            </svg>
            Google
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-white">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-400 hover:text-blue-300">
              Create Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;