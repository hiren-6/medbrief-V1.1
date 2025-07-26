import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Brain, Shield, Phone, MessageSquare } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useScrollToTop } from '../hooks/useScrollToTop';

const LoginPage: React.FC = () => {
  // Scroll to top on page load
  useScrollToTop();
  
  const navigate = useNavigate();
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'email' | 'mobile'>('email');
  const [showPassword, setShowPassword] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    mobile: '',
    password: '',
    otp: ''
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSendOTP = async () => {
    if (!formData.mobile) {
      alert('Please enter your mobile number first');
      return;
    }
    
    // Simulate OTP sending
    setOtpSent(true);
    setShowOTP(true);
    setCountdown(30);
    
    // In real implementation, you would call your OTP API here
    console.log('Sending OTP to:', formData.mobile);
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    
    // Simulate OTP resending
    setCountdown(30);
    console.log('Resending OTP to:', formData.mobile);
  };

  const handleVerifyOTP = async () => {
    if (!formData.otp || formData.otp.length !== 6) {
      alert('Please enter a valid 6-digit OTP');
      return;
    }
    
    // Simulate OTP verification
    console.log('Verifying OTP:', formData.otp);
    
    // In real implementation, verify OTP with backend
    // For demo, we'll just proceed with login
    handleSubmit(new Event('submit') as any);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    if (loginMethod === 'email') {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      if (error) {
        setLoading(false);
        setErrorMsg(error.message);
        return;
      }
      const user = data.user;
      if (user) {
        let { data: profile } = await supabase
          .from('profiles')
          .select('role, first_name')
          .eq('id', user.id)
          .single();
        if (profile && profile.role === 'admin') {
          setLoading(false);
          navigate('/dashboard/admin');
        } else if (profile && profile.role === 'doctor') {
          setLoading(false);
          navigate('/dashboard/doctor');
        } else if (profile && profile.role === 'patient') {
          setLoading(false);
          // Check if profile is complete (has first_name)
          if (profile.first_name) {
            navigate('/dashboard/patient');
          } else {
            navigate('/profile-setup');
          }
        } else {
          // If no profile, insert as patient and check if profile is complete
          let fullName = '';
          let firstName = '';
          let lastName = '';
          
          if (user.user_metadata) {
            if (user.user_metadata.full_name) {
              fullName = user.user_metadata.full_name;
              // Split full name into first and last name
              const nameParts = fullName.trim().split(' ');
              firstName = nameParts[0] || '';
              lastName = nameParts.slice(1).join(' ') || '';
            } else if (user.user_metadata.first_name || user.user_metadata.last_name) {
              firstName = user.user_metadata.first_name || '';
              lastName = user.user_metadata.last_name || '';
              fullName = `${firstName} ${lastName}`.trim();
            }
          }
          
          await supabase.from('profiles').insert({
            id: user.id,
            email: user.email,
            first_name: firstName,
            last_name: lastName,
            full_name: fullName,
            role: 'patient',
          });
          setLoading(false);
          navigate('/profile-setup');
        }
      } else {
        setLoading(false);
        setErrorMsg('Login failed: No user returned.');
      }
    } else {
      setLoading(false);
      setErrorMsg('Mobile login is not implemented yet. Please use email login.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordEmail) {
      alert('Please enter your email address');
      return;
    }
    
    // Simulate sending reset email
    console.log('Sending password reset email to:', forgotPasswordEmail);
    setResetEmailSent(true);
    
    // Reset after 3 seconds
    setTimeout(() => {
      setResetEmailSent(false);
      setShowForgotPassword(false);
      setForgotPasswordEmail('');
    }, 3000);
  };

  const handleBack = () => {
    navigate('/');
  };

  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Summaries',
      description: 'Smart medical document analysis'
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Your data is encrypted and protected'
    },
    {
      icon: Brain,
      title: 'Doctor-Ready Reports',
      description: 'Professional clinical summaries'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 flex pt-0">
      {/* Left Side - Features */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-teal-600 p-8 xl:p-12 flex-col justify-center relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-32 h-32 bg-white rounded-full"></div>
          <div className="absolute bottom-32 right-16 w-24 h-24 bg-white rounded-full"></div>
          <div className="absolute top-1/2 right-32 w-16 h-16 bg-white rounded-full"></div>
        </div>

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center space-x-4 mb-8 xl:mb-12">
            <div className="w-32 h-12 bg-white rounded-2xl p-2">
              <img 
                src="/Picture3.svg" 
                alt="MedBrief AI Logo" 
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Main Content */}
          <h1 className="text-3xl xl:text-4xl font-bold text-white mb-4 xl:mb-6 leading-tight">
            Welcome Back to MedBrief AI
          </h1>
          <p className="text-blue-100 text-lg mb-8 xl:mb-12 leading-relaxed">
            Sign in to access your medical summaries and continue your healthcare journey.
          </p>

          {/* Features */}
          <div className="space-y-4 xl:space-y-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="flex items-start space-x-4">
                  <div className="bg-white/20 p-3 rounded-lg">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">{feature.title}</h3>
                    <p className="text-blue-100 text-sm">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-8 min-h-screen">
        <div className="w-full max-w-md">
          {/* Back Button */}
          <button
            onClick={handleBack}
            className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors duration-200 mb-6"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Home</span>
          </button>

          {/* Form Container */}
          <div className="bg-white rounded-2xl shadow-xl p-6 lg:p-8 border border-gray-100 w-full">
            {/* Header */}
            <div className="text-center mb-6 lg:mb-8">
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-800 mb-2">
                {showForgotPassword ? 'Reset Password' : 'Sign In'}
              </h2>
              <p className="text-gray-600">
                {showForgotPassword 
                  ? 'Enter your email to receive a password reset link'
                  : 'Access your medical summaries and dashboard'
                }
              </p>
            </div>

            {/* Forgot Password Form */}
            {showForgotPassword ? (
              <div className="space-y-6">
                {!resetEmailSent ? (
                  <form onSubmit={handleForgotPassword} className="space-y-6">
                    <div>
                      <label htmlFor="forgotEmail" className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="email"
                          id="forgotEmail"
                          value={forgotPasswordEmail}
                          onChange={(e) => setForgotPasswordEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          placeholder="Enter your email address"
                          required
                        />
                      </div>
                    </div>
                    
                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-blue-600 to-teal-600 text-white py-3 px-4 rounded-lg hover:from-blue-700 hover:to-teal-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 font-medium text-lg"
                    >
                      Send Reset Link
                    </button>
                    
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(false)}
                        className="text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200"
                      >
                        Back to Sign In
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="text-center py-8">
                    <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Mail className="h-10 w-10 text-green-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-4">Check Your Email</h3>
                    <p className="text-gray-600 mb-6">
                      We've sent a password reset link to <strong>{forgotPasswordEmail}</strong>
                    </p>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-blue-800">
                        Didn't receive the email? Check your spam folder or try again.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Login Method Toggle */}
                <div className="mb-6">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('email');
                    setShowOTP(false);
                    setOtpSent(false);
                  }}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md transition-all duration-200 ${
                    loginMethod === 'email'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <Mail className="h-4 w-4" />
                  <span className="text-sm font-medium">Email</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('mobile');
                    setShowOTP(false);
                    setOtpSent(false);
                  }}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md transition-all duration-200 ${
                    loginMethod === 'mobile'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <Phone className="h-4 w-4" />
                  <span className="text-sm font-medium">Mobile</span>
                </button>
              </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-6">
                  {/* Error Message */}
                  {errorMsg && (
                    <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-2 text-center">
                      {errorMsg}
                    </div>
                  )}
                  {/* Email or Mobile Input */}
              {loginMethod === 'email' ? (
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label htmlFor="mobile" className="block text-sm font-medium text-gray-700 mb-2">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="tel"
                      id="mobile"
                      name="mobile"
                      value={formData.mobile}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="+91 98765 43210"
                      required
                      disabled={otpSent}
                    />
                  </div>
                  
                  {/* OTP Section */}
                  {showOTP && (
                    <div className="mt-4 space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2">
                          <MessageSquare className="h-5 w-5 text-green-600" />
                          <p className="text-sm text-green-800">
                            OTP sent to {formData.mobile}
                          </p>
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                          Enter 6-digit OTP
                        </label>
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            id="otp"
                            name="otp"
                            value={formData.otp}
                            onChange={handleInputChange}
                            maxLength={6}
                            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-center text-lg font-mono"
                            placeholder="000000"
                            required
                          />
                          <button
                            type="button"
                            onClick={handleVerifyOTP}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
                          >
                            Verify
                          </button>
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <button
                          type="button"
                          onClick={handleResendOTP}
                          disabled={countdown > 0}
                          className={`text-sm ${
                            countdown > 0
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-blue-600 hover:text-blue-700 cursor-pointer'
                          } transition-colors duration-200`}
                        >
                          {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Password Field (only for email login) */}
              {loginMethod === 'email' && (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Forgot Password Link (only for email login) */}
              {loginMethod === 'email' && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 transition-colors duration-200"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-teal-600 text-white py-3 px-4 rounded-lg hover:from-blue-700 hover:to-teal-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 font-medium text-lg flex items-center justify-center"
                disabled={loading}
              >
                {loading ? (
                  <span>Signing In...</span>
                ) : (
                  loginMethod === 'mobile' && !showOTP
                    ? 'Send OTP'
                    : 'Sign In'
                )}
              </button>

              {/* Toggle to Signup */}
              <div className="text-center">
                <p className="text-gray-600">
                  Don't have an account?{' '}
                  <Link
                    to="/signup"
                    className="text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200"
                  >
                    Sign Up
                  </Link>
                </p>
              </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;