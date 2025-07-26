import React, { useState, useEffect } from 'react';
import { Menu, X, LogIn, User, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useActiveSection } from '../hooks/useScrollAnimation';
import { scrollToTop } from '../hooks/useScrollToTop';
import { supabase } from '../supabaseClient';

interface NavigationProps {
  onLoginClick: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ onLoginClick }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const activeSection = useActiveSection();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      setIsLoggedIn(!!data.user);
    };
    checkUser();
    const { data: listener } = supabase.auth.onAuthStateChange(() => checkUser());
    return () => { listener.subscription.unsubscribe(); };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    navigate('/');
  };

  const scrollToTopHandler = () => {
    scrollToTop('smooth');
  };

  const scrollToSection = (sectionId: string) => {
    if (sectionId === 'home') {
      scrollToTopHandler();
    } else {
      const element = document.getElementById(sectionId);
      if (element) {
        // Calculate offset to account for fixed navbar height + minimal padding
        const navbarHeight = 70; // Fixed navbar height
        const extraPadding = 20; // Reduced padding for better readability
        const totalOffset = navbarHeight + extraPadding;
        
        const elementPosition = element.offsetTop - totalOffset;
        
        window.scrollTo({
          top: Math.max(0, elementPosition),
          behavior: 'smooth'
        });
      }
    }
    setIsMenuOpen(false);
  };

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'benefits', label: 'Benefits' },
    { id: 'clinical-workflow', label: 'Clinical Workflow' },
    { id: 'testimonials', label: 'Reviews' },
    { id: 'faq', label: 'FAQ' }
  ];

  return (
    <nav className="fixed top-2 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-full mx-auto">
        <div className="bg-white/95 backdrop-blur-sm rounded-[2rem] shadow-lg border border-gray-200">
          <div className="flex justify-between items-center h-14 px-4 sm:px-6 lg:px-8">
            {/* Logo Only - Left aligned and sized appropriately */}
            <button 
              onClick={scrollToTopHandler}
              className="group hover:scale-105 transition-transform duration-200 flex-shrink-0 py-1"
            >
              <div className="w-32 h-12 sm:w-36 sm:h-12 lg:w-40 lg:h-12 rounded-xl overflow-hidden">
                <img 
                  src="/Picture3.svg" 
                  alt="MedBrief AI Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
            </button>

            {/* Desktop Navigation - Right aligned */}
            <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
              {/* Navigation Items - Compact spacing */}
              <div className="flex items-center space-x-4 lg:space-x-6">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`relative text-gray-700 hover:text-blue-600 transition-all duration-300 py-2 font-medium text-sm lg:text-base whitespace-nowrap ${
                      activeSection === item.id ? 'text-blue-600' : ''
                    }`}
                  >
                    {item.label}
                    {activeSection === item.id && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-teal-500 rounded-full animated-underline"></div>
                    )}
                  </button>
                ))}
              </div>
              
              {/* Login button - Separated with margin */}
              <button 
                onClick={() => navigate('/login')}
                className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white px-4 lg:px-5 py-2 rounded-xl hover:from-blue-600 hover:to-teal-600 transition-all duration-300 transform hover:scale-105 font-medium text-sm lg:text-base flex-shrink-0 ml-4"
              >
                <User className="h-4 w-4" />
                <span>Login</span>
              </button>
            </div>

            {/* Mobile menu button - Right aligned */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-gray-700 hover:text-blue-600 transition-colors duration-200 p-2 rounded-xl hover:bg-gray-100"
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-gray-200 bg-white/95 backdrop-blur-sm rounded-b-[2rem]">
              <div className="px-4 sm:px-6 pt-4 pb-6 space-y-3">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`block w-full text-left px-4 py-3 text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-xl transition-all duration-200 font-medium ${
                      activeSection === item.id ? 'text-blue-600 bg-blue-50' : ''
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
                <div className="pt-2">
                  <button 
                    onClick={() => navigate('/login')}
                    className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-teal-600 transition-all duration-300 transform hover:scale-105 font-medium"
                  >
                    <User className="h-4 w-4" />
                    <span>Login</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;