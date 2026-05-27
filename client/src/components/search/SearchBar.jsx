import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Search } from 'lucide-react';
import { geocodeCity } from '@/api/geocode';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export default function SearchBar({ variant = 'hero' }) {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm({
    mode: 'onBlur',
    defaultValues: {
      destination: '',
      startDate: today(),
      endDate: inDays(7),
    },
  });

  const startDate = watch('startDate');

  const onSubmit = async (form) => {
    setSubmitError(null);
    try {
      const results = await geocodeCity(form.destination.trim());
      const top = results[0];
      const params = new URLSearchParams({
        name: top.name,
        country: top.country ?? '',
        lat: String(top.latitude),
        lng: String(top.longitude),
        tz: top.timezone,
        start: form.startDate,
        end: form.endDate,
      });
      navigate(`/search?${params.toString()}`);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      if (code === 'GEOCODE_NO_RESULTS') {
        setSubmitError(`We couldn't find "${form.destination}". Try a different spelling.`);
      } else {
        setSubmitError('Something went wrong. Try again.');
      }
    }
  };

  const isHero = variant === 'hero';

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className={
        isHero
          ? 'bg-white rounded-2xl shadow-card p-4 sm:p-6 grid gap-3 sm:gap-4 sm:grid-cols-[2fr_1fr_1fr_auto]'
          : 'bg-white rounded-lg shadow-soft p-3 grid gap-2 sm:gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]'
      }
    >
      <FormField
        label="Destination"
        placeholder="Paris, Tokyo, New York…"
        error={errors.destination?.message}
        {...register('destination', {
          required: 'Where are you going?',
          maxLength: { value: 100, message: 'Too long' },
        })}
      />
      <FormField
        label="Start date"
        type="date"
        min={today()}
        error={errors.startDate?.message}
        {...register('startDate', { required: 'Required' })}
      />
      <FormField
        label="End date"
        type="date"
        min={startDate || today()}
        error={errors.endDate?.message}
        {...register('endDate', {
          required: 'Required',
          validate: (val, all) =>
            new Date(val) >= new Date(all.startDate) || 'End must be after start',
        })}
      />
      <div className="flex items-end">
        <Button type="submit" variant="primary" disabled={isSubmitting} fullWidth>
          {isSubmitting ? (
            'Searching…'
          ) : (
            <>
              <Search size={18} className="inline mr-1" /> Search
            </>
          )}
        </Button>
      </div>

      {submitError && (
        <div role="alert" className="sm:col-span-4 text-sm text-red-700">
          {submitError}
        </div>
      )}
    </form>
  );
}
