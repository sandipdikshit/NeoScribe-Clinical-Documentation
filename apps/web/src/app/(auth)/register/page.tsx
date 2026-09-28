'use client'
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'
import authService from '@/services/authApis';
import Image from 'next/image';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    vEmail: '',
    txPassword: '',
    confirmPassword: '',
    vName: '',
    vSpecialty: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    hasLowerCase: false,
    hasUpperCase: false,
    hasNumber: false,
    hasSpecialChar: false,
    isMinLength: false
  });
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const router = useRouter()

  // Check password strength whenever the password changes
  useEffect(() => {
    checkPasswordStrength(formData.txPassword);
  }, [formData.txPassword]);

  const checkPasswordStrength = (password: string) => {
    const hasLowerCase = /[a-z]/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
    const isMinLength = password.length >= 8;

    // Calculate a score based on criteria met
    let score = 0;
    if (hasLowerCase) score += 1;
    if (hasUpperCase) score += 1;
    if (hasNumber) score += 1;
    if (hasSpecialChar) score += 1;
    if (isMinLength) score += 1;

    setPasswordStrength({
      score,
      hasLowerCase,
      hasUpperCase,
      hasNumber,
      hasSpecialChar,
      isMinLength
    });
  };

  const getStrengthLabel = () => {
    const { score } = passwordStrength;
    if (score === 0) return { text: 'Very Weak', color: 'bg-gray-200' };
    if (score === 1) return { text: 'Weak', color: 'bg-red-500' };
    if (score === 2) return { text: 'Fair', color: 'bg-orange-500' };
    if (score === 3) return { text: 'Good', color: 'bg-yellow-500' };
    if (score === 4) return { text: 'Strong', color: 'bg-blue-500' };
    return { text: 'Very Strong', color: 'bg-green-500' };
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Sanitize inputs to prevent XSS attacks
    const sanitizedValue = name === 'password' || name === 'confirmPassword'
      ? value // Passwords shouldn't be sanitized as they may include special characters
      : value.replace(/<[^>]*>/g, ''); // Basic XSS prevention

    setFormData({
      ...formData,
      [name]: sanitizedValue,
    });
  };

  const togglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
  };

  const toggleConfirmPasswordVisibility = () => {
    setConfirmPasswordVisible(!confirmPasswordVisible);
  };

  const validatePassword = () => {
    const { hasLowerCase, hasUpperCase, hasNumber, hasSpecialChar, isMinLength } = passwordStrength;

    if (!hasLowerCase || !hasUpperCase || !hasNumber || !isMinLength) {
      setError('Password must contain at least 8 characters, including 1 lowercase letter, 1 uppercase letter, and 1 number.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate password strength
    if (!validatePassword()) {
      return;
    }

    // Validate password match
    if (formData.txPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { confirmPassword, ...providerData } = formData;

      // Register the user
      const response = await authService.register({
        vEmail: providerData.vEmail,
        txPassword: providerData.txPassword,
        vName: providerData.vName,
        vSpecialty: providerData.vSpecialty
      });

      // Check if registration was successful and we have a valid response
      if (response.code == 200) {

        // Optional: Show success message before redirect
        setError(null); // Clear any previous errors

        // Set a success message if you have a success state
        // setSuccess('Account created successfully! Redirecting to login...');

        // Redirect after a short delay to allow the user to see success message
        setTimeout(() => {
          router.push('/login');
        }, 1500);
      } else if (response.code == 400) { 
        // Handle specific error codes from the server
        setError(response.message || 'Registration failed. Please try again.');
      }else {
        // If response doesn't match expected format
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      // Extract error message from response or use generic message
      const errorMessage = err.response?.data?.detail || 'Registration failed. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const strengthLabel = getStrengthLabel();

  return (
    <div className="min-h-screen flex items-center justify-center bg-white py-12 px-4 sm:px-6 lg:px-8 ">
      <div className="w-full max-w-md bg-white overflow-hidden rounded-lg shadow-2xl border-[10px] border-white">
        <div className="px-8 pt-8 pb-4">
          <div className="flex flex-col items-center">
            <Image
              src="/name.png"
              alt="Neoscribe Logo"
              width={150}
              height={36}
              className="m-2"
            />
            <h2 className="text-center text-2xl font-semibold text-gray-900">
              Signup to Neoscribe
            </h2>
          </div>


          {error && (
            <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}
        </div>

        <form className="px-8 pt-2 pb-8" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="vEmail" className="block text-sm font-medium text-gray-700">Email</label>
              <input
                id="vEmail"
                name="vEmail"
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent text-sm"
                placeholder="ex. JohnSmith"
                value={formData.vEmail}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="vName" className="block text-sm font-medium text-gray-700">Name</label>
              <input
                id="vName"
                name="vName"
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent text-sm"
                placeholder="First Name"
                value={formData.vName}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="vSpecialty" className="block text-sm font-medium text-gray-700">Specialty</label>
              <div className="relative">
                <select
                  id="vSpecialty"
                  name="vSpecialty"
                  required
                  className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent text-sm appearance-none"
                  value={formData.vSpecialty}
                  onChange={handleChange}
                >
                  <option value="">Select a specialty</option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="Dermatology">Dermatology</option>
                  <option value="Endocrinology">Endocrinology</option>
                  <option value="Gastroenterology">Gastroenterology</option>
                  <option value="Neurology">Neurology</option>
                  <option value="Oncology">Oncology</option>
                  <option value="Pediatrics">Pediatrics</option>
                  <option value="Psychiatry">Psychiatry</option>
                  <option value="Radiology">Radiology</option>
                  <option value="Surgery">Surgery</option>
                  <option value="Other">Other</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="txPassword" className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <input
                  id="txPassword"
                  name="txPassword"
                  type={passwordVisible ? "text" : "password"}
                  required
                  className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent text-sm"
                  placeholder="••••••••••"
                  value={formData.txPassword}
                  onChange={handleChange}
                />
                <div
                  className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
                  onClick={togglePasswordVisibility}
                >
                  {passwordVisible ? (
                    <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                  )}
                </div>
              </div>

              {/* Password strength meter */}
              {formData.txPassword && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">Password strength: </span>
                    <span className="text-xs font-medium">{strengthLabel.text}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${strengthLabel.color}`}
                      style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                    ></div>
                  </div>

                  {/* Password requirements */}
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-600">Your password must have:</p>
                    <ul className="text-xs space-y-1">
                      <li className={`flex items-center ${passwordStrength.isMinLength ? 'text-green-600' : 'text-gray-600'}`}>
                        {passwordStrength.isMinLength ? (
                          <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                          </svg>
                        ) : (
                          <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                          </svg>
                        )}
                        At least 8 characters
                      </li>
                      <li className={`flex items-center ${passwordStrength.hasLowerCase ? 'text-green-600' : 'text-gray-600'}`}>
                        {passwordStrength.hasLowerCase ? (
                          <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                          </svg>
                        ) : (
                          <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                          </svg>
                        )}
                        At least 1 lowercase letter (a-z)
                      </li>
                      <li className={`flex items-center ${passwordStrength.hasUpperCase ? 'text-green-600' : 'text-gray-600'}`}>
                        {passwordStrength.hasUpperCase ? (
                          <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                          </svg>
                        ) : (
                          <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                          </svg>
                        )}
                        At least 1 uppercase letter (A-Z)
                      </li>
                      <li className={`flex items-center ${passwordStrength.hasNumber ? 'text-green-600' : 'text-gray-600'}`}>
                        {passwordStrength.hasNumber ? (
                          <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                          </svg>
                        ) : (
                          <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                          </svg>
                        )}
                        At least 1 number (0-9)
                      </li>
                      <li className={`flex items-center ${passwordStrength.hasSpecialChar ? 'text-green-600' : 'text-gray-600'}`}>
                        {passwordStrength.hasSpecialChar ? (
                          <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                          </svg>
                        ) : (
                          <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                          </svg>
                        )}
                        At least 1 special character (!@#$%^&*)
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm Password</label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={confirmPasswordVisible ? "text" : "password"}
                  required
                  className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent text-sm"
                  placeholder="••••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
                <div
                  className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
                  onClick={toggleConfirmPasswordVisibility}
                >
                  {confirmPasswordVisible ? (
                    <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                  )}
                </div>
              </div>
              {formData.confirmPassword && formData.txPassword !== formData.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {loading ? 'Registering...' : 'Register'}
            </button>
          </div>

          <div className="mt-4 text-sm text-center">
            <span className="text-gray-600">Already have an account? </span>
            <a href="/login" className="font-medium text-blue-600 hover:text-blue-500">
              Sign in
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;