import React, { useState, useEffect } from 'react';

const TestPage: React.FC = () => {
  const [status, setStatus] = useState<string>('Checking...');
  const [details, setDetails] = useState<string>('');

  useEffect(() => {
    const checkConfiguration = async () => {
      try {
        // Check environment variables
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
          setStatus('❌ Configuration Missing');
          setDetails(`URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}\nKey: ${supabaseAnonKey ? '✅ Set' : '❌ Missing'}`);
          return;
        }

        setStatus('✅ Configuration Found');
        setDetails('Environment variables are properly configured.');

        // Try to import and initialize Supabase
        const { supabase } = await import('../supabaseClient');
        
        // Test connection
        const { data, error } = await supabase.auth.getUser();
        
        if (error) {
          setDetails(`Configuration OK, but connection failed: ${error.message}`);
        } else if (data.user) {
          setDetails(`✅ Connected successfully! User: ${data.user.email}`);
        } else {
          setDetails('✅ Connected successfully! No user logged in.');
        }

      } catch (error: any) {
        setStatus('❌ Error');
        setDetails(`Error: ${error.message}`);
      }
    };

    checkConfiguration();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Configuration Test</h1>
        
        <div className="space-y-4">
          <div className="p-4 bg-gray-100 rounded-lg">
            <h2 className="font-semibold text-gray-800 mb-2">Status</h2>
            <p className="text-lg">{status}</p>
          </div>
          
          <div className="p-4 bg-gray-100 rounded-lg">
            <h2 className="font-semibold text-gray-800 mb-2">Details</h2>
            <pre className="text-sm text-gray-600 whitespace-pre-wrap">{details}</pre>
          </div>
          
          <div className="p-4 bg-blue-50 rounded-lg">
            <h2 className="font-semibold text-blue-800 mb-2">Next Steps</h2>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• If configuration is missing, create a .env file</li>
              <li>• If connection fails, check your Supabase credentials</li>
              <li>• If everything is OK, try accessing /profile again</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestPage; 