import { Link } from 'react-router-dom';
import { useDarkMode } from '../context/DarkModeContext';

const LandingPage = () => {
  const { darkMode, toggleDarkMode } = useDarkMode();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg px-6 py-8 ring shadow-xl ring-gray-900/5">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-900 border-b dark:border-gray-700">
        <div className="flex items-center space-x-8">
          <span className="text-2xl font-bold">Logo</span>
          <div className="hidden md:flex space-x-6">
            <a href="#" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Features</a>
            <a href="#" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Product guide</a>
            <a href="#" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Templates</a>
            <a href="#" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Pricing</a>
            <a href="#" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Enterprise</a>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white"
          >
            {darkMode ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          <Link to="/login" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
            Sign in
          </Link>
          <Link to="/register" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
            Get it free
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Left Column */}
            <div className="space-y-8">
              <h1 className="text-5xl font-bold text-gray-900 dark:text-white">
                Great outcomes
                <br />
                start with Jira
                <div className="h-2 w-32 bg-yellow-400 mt-2"></div>
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300">
                The only project management tool you need to plan and track work across every team.
              </p>
            </div>

            {/* Right Column - Sign Up Form */}
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg space-y-6 shadow-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Work email</label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Find teammates, plus keep work and life separate by using your work email.
                </p>
              </div>

              <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                Sign up
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">Or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  <svg aria-hidden="true" viewBox="0 0 18 18" className='h-5 w-5 mr-2'> 
                  <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"></path> 
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"></path> 
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"></path> 
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"></path> 
                  </svg>
                  Google
                </button>
                <button className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  <svg aria-hidden="true" viewBox="0 0 21 21" className='h-5 w-5 mr-2' >
                  <path fill="#f25022" d="M1 1h9v9H1z"></path>
                  <path fill="#00a4ef" d="M1 11h9v9H1z"></path>
                  <path fill="#7fba00" d="M11 1h9v9h-9z"></path>
                  <path fill="#ffb900" d="M11 11h9v9h-9z"></path>
                  </svg>
                  Microsoft
                </button>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mt-20">
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 hover:shadow-lg transition-shadow">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">PRODUCT & ISSUE TRACKING</h3>
              <h2 className="text-xl font-bold mb-4 dark:text-white">Software Development</h2>
              {/* Add your feature content here */}
            </div>
            {/* Add more feature cards similarly */}
          </div>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;