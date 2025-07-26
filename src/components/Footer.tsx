import React from 'react';
import { Mail, Phone, MapPin, Facebook, Twitter, Linkedin, Instagram } from 'lucide-react';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { scrollToTop } from '../hooks/useScrollToTop';

interface FooterProps {
  onPrivacyClick: () => void;
  onTermsClick: () => void;
  onCookieClick: () => void;
}

const Footer: React.FC<FooterProps> = ({ onPrivacyClick, onTermsClick, onCookieClick }) => {
  const { elementRef, isVisible } = useScrollAnimation({ threshold: 0.1 });

  const handleScrollToTop = () => {
    scrollToTop('smooth');
  };

  return (
    <footer 
      ref={elementRef}
      className={`bg-gray-900 text-white transition-all duration-700 ease-out ${
        isVisible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-12'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className={`lg:col-span-2 transition-all duration-600 delay-100 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            <button 
              onClick={handleScrollToTop}
              className="group flex items-center space-x-4 mb-6 hover:scale-105 transition-transform duration-200"
            >
              <div className="w-24 h-8 rounded-xl overflow-hidden shadow-lg bg-white p-1">
                <img 
                  src="/Picture3.svg" 
                  alt="MedBrief AI Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="font-bold text-2xl group-hover:logo-shimmer"></span>
            </button>
            <p className="text-gray-300 mb-6 max-w-md leading-relaxed text-sm sm:text-base">
              Transforming healthcare communication with AI-powered medical summaries. 
              Helping doctors and patients connect better, one summary at a time.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="bg-gray-800 p-2 rounded-lg hover:bg-gray-700 transition-colors duration-200">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="bg-gray-800 p-2 rounded-lg hover:bg-gray-700 transition-colors duration-200">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="bg-gray-800 p-2 rounded-lg hover:bg-gray-700 transition-colors duration-200">
                <Linkedin className="h-5 w-5" />
              </a>
              <a href="#" className="bg-gray-800 p-2 rounded-lg hover:bg-gray-700 transition-colors duration-200">
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className={`transition-all duration-600 delay-200 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            <h3 className="font-semibold text-lg mb-6">Quick Links</h3>
            <ul className="space-y-3">
              <li>
                <a href="#benefits" className="text-gray-300 hover:text-white transition-colors duration-200 text-sm sm:text-base">
                  Benefits
                </a>
              </li>
              <li>
                <a href="#clinical-workflow" className="text-gray-300 hover:text-white transition-colors duration-200 text-sm sm:text-base">
                  Clinical Workflow
                </a>
              </li>
              <li>
                <a href="#testimonials" className="text-gray-300 hover:text-white transition-colors duration-200 text-sm sm:text-base">
                  Testimonials
                </a>
              </li>
              <li>
                <a href="#faq" className="text-gray-300 hover:text-white transition-colors duration-200 text-sm sm:text-base">
                  FAQ
                </a>
              </li>
              <li>
                <button 
                  onClick={onPrivacyClick}
                  className="text-gray-300 hover:text-white transition-colors duration-200 text-sm sm:text-base text-left"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button 
                  onClick={onTermsClick}
                  className="text-gray-300 hover:text-white transition-colors duration-200 text-sm sm:text-base text-left"
                >
                  Terms of Service
                </button>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className={`transition-all duration-600 delay-300 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            <h3 className="font-semibold text-lg mb-6">Contact Us</h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-blue-400 mt-1 flex-shrink-0" />
                <div className="text-gray-300 text-sm sm:text-base">
                  <p>Tech Hub, Koramangala</p>
                  <p>Bangalore, Karnataka 560034</p>
                  <p>India</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <span className="text-gray-300 text-sm sm:text-base">+91 80 4567 8900</span>
              </div>
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <span className="text-gray-300 text-sm sm:text-base">support@medbrief.ai</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className={`border-t border-gray-800 mt-8 sm:mt-12 pt-6 sm:pt-8 transition-all duration-600 delay-400 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}>
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <div className="text-gray-400 text-xs sm:text-sm">
              © 2025 MedBrief AI. All rights reserved.
            </div>
            <div className="flex flex-wrap justify-center space-x-4 sm:space-x-6 text-xs sm:text-sm">
              <button 
                onClick={onPrivacyClick}
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                Privacy Policy
              </button>
              <button 
                onClick={onTermsClick}
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                Terms of Service
              </button>
              <button 
                onClick={onCookieClick}
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                Cookie Policy
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;