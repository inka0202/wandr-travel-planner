import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { safeNext } from '@/lib/safeRedirect';

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitError, setSubmitError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ mode: 'onBlur' });

  const onSubmit = async (data) => {
    setSubmitError(null);
    try {
      await registerUser(data.email, data.password, data.displayName);
      const next = safeNext(new URLSearchParams(location.search).get('next'), window.location.origin);
      navigate(next, { replace: true });
    } catch (err) {
      if (!err.response) {
        setSubmitError('Connection failed. Check your internet and try again.');
        return;
      }
      const code = err.response?.data?.error?.code;
      if (code === 'EMAIL_EXISTS') {
        setSubmitError(
          <>
            That email is already registered.{' '}
            <Link to="/login" className="font-medium underline">
              Log in instead.
            </Link>
          </>,
        );
      } else {
        setSubmitError(err.response?.data?.error?.message || 'Something went wrong. Try again.');
      }
    }
  };

  return (
    <div className="mx-auto mt-16 max-w-md px-4">
      <div className="rounded-2xl bg-white p-8 shadow-card">
        <h1 className="mb-2 font-serif text-3xl text-navy-900">Create your account</h1>
        <p className="mb-6 text-navy-500">Save trips and pick up where you left off.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            label="Display name (optional)"
            hint="Shown on your profile. Max 60 characters."
            error={errors.displayName?.message}
            {...register('displayName', {
              maxLength: { value: 60, message: 'Maximum 60 characters' },
            })}
          />

          <FormField
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Enter a valid email address',
              },
            })}
          />

          <FormField
            label="Password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters."
            error={errors.password?.message}
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 8, message: 'At least 8 characters' },
              maxLength: { value: 128, message: 'Maximum 128 characters' },
            })}
          />

          {submitError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <Button type="submit" variant="primary" fullWidth disabled={isSubmitting}>
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-navy-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-orange-700 hover:text-orange-800">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
