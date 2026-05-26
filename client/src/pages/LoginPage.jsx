import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  const { login } = useAuth();
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
      await login(data.email, data.password);
      const next = new URLSearchParams(location.search).get('next') || '/trips';
      navigate(next, { replace: true });
    } catch (err) {
      const code = err.response?.data?.error?.code;
      if (code === 'RATE_LIMITED') {
        setSubmitError('Too many attempts. Wait 15 minutes and try again.');
      } else {
        // Generic message — never reveal whether email or password was wrong
        setSubmitError('Invalid email or password.');
      }
    }
  };

  return (
    <div className="mx-auto mt-16 max-w-md px-4">
      <div className="rounded-2xl bg-white p-8 shadow-card">
        <h1 className="mb-2 font-serif text-3xl text-navy-900">Welcome back</h1>
        <p className="mb-6 text-navy-500">Log in to your Wandr account.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email', { required: 'Email is required' })}
          />

          <FormField
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password', { required: 'Password is required' })}
          />

          {submitError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <Button type="submit" variant="primary" fullWidth disabled={isSubmitting}>
            {isSubmitting ? 'Logging in…' : 'Log in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-navy-500">
          No account yet?{' '}
          <Link to="/register" className="font-medium text-orange-700 hover:text-orange-800">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
